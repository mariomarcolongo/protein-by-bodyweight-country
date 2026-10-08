#!/usr/bin/env python3
"""Build the country-year protein/bodyweight/GDP explorer dataset.

The current model combines national protein supply with a preliminary adult
bodyweight proxy derived from sex-specific age-standardized BMI and
representative-cohort height. It is an ecological indicator, not an estimate of
individual dietary intake.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from io import BytesIO
from pathlib import Path
from typing import Iterable

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config" / "sources.json"
REPRESENTATIVE_ADULT_AGE = 40
VERSION = "0.3.0-preview"
USER_AGENT = (
    f"protein-by-bodyweight-country/{VERSION} "
    "(+https://github.com/mariomarcolongo/protein-by-bodyweight-country)"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data" / "derived")
    return parser.parse_args()


def request(url: str) -> requests.Response:
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=120)
    response.raise_for_status()
    return response


def download_csv(url: str) -> pd.DataFrame:
    return pd.read_csv(BytesIO(request(url).content))


def download_world_bank_indicator(url: str, value_name: str) -> pd.DataFrame:
    payload = request(url).json()
    if not isinstance(payload, list) or len(payload) < 2 or not isinstance(payload[1], list):
        raise ValueError("Unexpected World Bank API response")

    rows: list[dict[str, object]] = []
    for item in payload[1]:
        code = item.get("countryiso3code")
        year = item.get("date")
        value = item.get("value")
        if (
            isinstance(code, str)
            and re.fullmatch(r"[A-Z]{3}", code)
            and isinstance(year, str)
            and year.isdigit()
            and value is not None
        ):
            rows.append(
                {
                    "Code": code,
                    "Year": int(year),
                    value_name: float(value),
                }
            )

    frame = pd.DataFrame(rows)
    if frame.empty:
        raise ValueError(f"No World Bank rows were returned for {value_name}")
    return frame.drop_duplicates(["Code", "Year"])


def value_column(frame: pd.DataFrame) -> str:
    dimensions = {"Entity", "Code", "Year"}
    candidates = [column for column in frame.columns if column not in dimensions]
    if len(candidates) != 1:
        raise ValueError(f"Expected exactly one value column, found {candidates}")
    return candidates[0]


def tidy(frame: pd.DataFrame, value_name: str) -> pd.DataFrame:
    column = value_column(frame)
    result = frame.rename(columns={column: value_name}).copy()
    result = result[result["Code"].notna() & result["Code"].str.fullmatch(r"[A-Z]{3}")]
    result["Year"] = pd.to_numeric(result["Year"], errors="coerce").astype("Int64")
    result[value_name] = pd.to_numeric(result[value_name], errors="coerce")
    return result[["Entity", "Code", "Year", value_name]].dropna(subset=["Year"])


def interpolate_height(
    height: pd.DataFrame, target_years: Iterable[int], value_name: str
) -> pd.DataFrame:
    rows: list[pd.DataFrame] = []
    target_years = sorted(set(int(year) for year in target_years))
    for code, group in height.groupby("Code", sort=False):
        group = group.sort_values("Year").drop_duplicates("Year")
        if group.empty:
            continue
        source = group.set_index("Year")[value_name]
        union = source.index.union(pd.Index(target_years, dtype="int64"))
        interpolated = (
            source.reindex(union)
            .sort_index()
            .interpolate(method="index", limit_area="inside")
        )
        selected = interpolated.reindex(target_years)
        entity = group["Entity"].iloc[0]
        rows.append(
            pd.DataFrame(
                {
                    "Entity": entity,
                    "Code": code,
                    "Year": target_years,
                    value_name: selected.values,
                    f"{value_name}_interpolated": ~pd.Index(target_years).isin(
                        source.index
                    ),
                }
            )
        )
    if not rows:
        return pd.DataFrame(columns=["Entity", "Code", "Year", value_name])
    return pd.concat(rows, ignore_index=True)


def validate(frame: pd.DataFrame) -> None:
    duplicates = frame.duplicated(["Code", "Year"]).sum()
    if duplicates:
        raise ValueError(f"Found {duplicates} duplicate country-year rows")

    derived = frame.dropna(
        subset=[
            "protein_supply_g_day",
            "estimated_adult_bodyweight_kg",
            "protein_supply_g_kg_day",
        ]
    )
    if derived.empty:
        raise ValueError("No normalized records were generated")

    recalculated = (
        derived["protein_supply_g_day"] / derived["estimated_adult_bodyweight_kg"]
    )
    max_error = (recalculated - derived["protein_supply_g_kg_day"]).abs().max()
    if max_error > 1e-10:
        raise ValueError(f"Derived ratio validation failed; max error={max_error}")

    weight = derived["estimated_adult_bodyweight_kg"]
    if not weight.between(30, 160).all():
        bad = derived.loc[
            ~weight.between(30, 160),
            ["Entity", "Year", "estimated_adult_bodyweight_kg"],
        ]
        raise ValueError(f"Implausible bodyweight estimates:\n{bad.head()}")

    ratio = derived["protein_supply_g_kg_day"]
    if not ratio.between(0.2, 5.0).all():
        bad = derived.loc[
            ~ratio.between(0.2, 5.0),
            ["Entity", "Year", "protein_supply_g_kg_day"],
        ]
        raise ValueError(f"Implausible protein ratios:\n{bad.head()}")

    gdp = frame["gdp_per_capita_ppp_2021"].dropna()
    if gdp.empty:
        raise ValueError("No GDP-per-capita observations were generated")
    if not (gdp > 0).all():
        raise ValueError("GDP per capita contains zero or negative values")


def web_number(value: object, digits: int) -> float | None:
    if value is None or pd.isna(value):
        return None
    return round(float(value), digits)


def write_web_payload(
    result: pd.DataFrame, metadata: dict[str, object], output_dir: Path
) -> Path:
    """Write a compact browser payload.

    Country names and ISO codes are stored once. Each observation is encoded as:
    [country index, year, protein g/day, bodyweight kg, protein g/kg/day,
     normalized status, GDP per capita PPP].
    """

    latest_names = (
        result.sort_values("Year")
        .drop_duplicates("Code", keep="last")[["Code", "Entity"]]
        .sort_values(["Entity", "Code"])
        .reset_index(drop=True)
    )
    countries = latest_names[["Code", "Entity"]].values.tolist()
    country_index = {code: index for index, (code, _name) in enumerate(countries)}

    rows = [
        [
            country_index[row.Code],
            int(row.Year),
            web_number(row.protein_supply_g_day, 3),
            web_number(row.estimated_adult_bodyweight_kg, 3),
            web_number(row.protein_supply_g_kg_day, 5),
            1 if row.estimate_status == "preliminary_adult_proxy" else 0,
            web_number(row.gdp_per_capita_ppp_2021, 1),
        ]
        for row in result.itertuples(index=False)
    ]

    normalized = result["protein_supply_g_kg_day"].notna()
    gdp = result["gdp_per_capita_ppp_2021"].notna()
    web_payload = {
        "metadata": {
            **metadata,
            "schema": {
                "countries": "[ISO3 code, display name]",
                "rows": (
                    "[country index, year, protein g/person/day, estimated adult kg, "
                    "protein g/kg/day, normalized status, GDP per capita PPP "
                    "(constant 2021 international $)]"
                ),
            },
            "coverage": {
                "records": int(len(result)),
                "normalized_records": int(normalized.sum()),
                "normalized_countries": int(result.loc[normalized, "Code"].nunique()),
                "protein_year_min": int(result["Year"].min()),
                "protein_year_max": int(result["Year"].max()),
                "normalized_year_min": int(result.loc[normalized, "Year"].min()),
                "normalized_year_max": int(result.loc[normalized, "Year"].max()),
                "gdp_records": int(gdp.sum()),
                "gdp_countries": int(result.loc[gdp, "Code"].nunique()),
                "gdp_year_min": int(result.loc[gdp, "Year"].min()),
                "gdp_year_max": int(result.loc[gdp, "Year"].max()),
            },
        },
        "countries": countries,
        "rows": rows,
    }

    path = output_dir / "explorer.json"
    path.write_text(
        json.dumps(
            web_payload,
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        ),
        encoding="utf-8",
    )
    return path


def main() -> None:
    args = parse_args()
    sources = json.loads(args.config.read_text(encoding="utf-8"))
    args.output_dir.mkdir(parents=True, exist_ok=True)

    protein = tidy(
        download_csv(sources["protein_supply"]["url"]), "protein_supply_g_day"
    )
    bmi_male = tidy(download_csv(sources["bmi_male"]["url"]), "bmi_male")
    bmi_female = tidy(download_csv(sources["bmi_female"]["url"]), "bmi_female")
    height_male = tidy(
        download_csv(sources["height_male"]["url"]), "height_male_cm"
    )
    height_female = tidy(
        download_csv(sources["height_female"]["url"]), "height_female_cm"
    )
    gdp = download_world_bank_indicator(
        sources["gdp_per_capita_ppp"]["url"], "gdp_per_capita_ppp_2021"
    )

    bmi = bmi_male.merge(
        bmi_female, on=["Entity", "Code", "Year"], how="inner"
    )
    bmi["birth_cohort"] = bmi["Year"].astype(int) - REPRESENTATIVE_ADULT_AGE

    height_years = bmi["birth_cohort"].unique().tolist()
    male_height = interpolate_height(
        height_male, height_years, "height_male_cm"
    ).rename(columns={"Year": "birth_cohort"})
    female_height = interpolate_height(
        height_female, height_years, "height_female_cm"
    ).rename(columns={"Year": "birth_cohort"})

    anthropometry = bmi.merge(
        male_height.drop(columns=["Entity"]),
        on=["Code", "birth_cohort"],
        how="left",
    ).merge(
        female_height.drop(columns=["Entity"]),
        on=["Code", "birth_cohort"],
        how="left",
    )

    anthropometry["estimated_male_weight_kg"] = anthropometry["bmi_male"] * (
        anthropometry["height_male_cm"] / 100
    ) ** 2
    anthropometry["estimated_female_weight_kg"] = anthropometry["bmi_female"] * (
        anthropometry["height_female_cm"] / 100
    ) ** 2
    anthropometry["estimated_adult_bodyweight_kg"] = (
        anthropometry["estimated_male_weight_kg"]
        + anthropometry["estimated_female_weight_kg"]
    ) / 2
    anthropometry["height_interpolated"] = (
        anthropometry["height_male_cm_interpolated"].fillna(True)
        | anthropometry["height_female_cm_interpolated"].fillna(True)
    )

    keep = anthropometry[
        [
            "Code",
            "Year",
            "birth_cohort",
            "bmi_male",
            "bmi_female",
            "height_male_cm",
            "height_female_cm",
            "estimated_adult_bodyweight_kg",
            "height_interpolated",
        ]
    ]

    result = (
        protein.merge(keep, on=["Code", "Year"], how="left")
        .merge(gdp, on=["Code", "Year"], how="left")
    )
    result["protein_supply_g_kg_day"] = (
        result["protein_supply_g_day"]
        / result["estimated_adult_bodyweight_kg"]
    )
    result["estimate_status"] = result["protein_supply_g_kg_day"].notna().map(
        {True: "preliminary_adult_proxy", False: "protein_supply_only"}
    )

    result = result.sort_values(["Entity", "Year"]).reset_index(drop=True)
    numeric_columns = result.select_dtypes(include="number").columns
    result[numeric_columns] = result[numeric_columns].replace(
        [math.inf, -math.inf], pd.NA
    )
    validate(result)

    metadata: dict[str, object] = {
        "title": "Protein supply per estimated adult bodyweight by country",
        "version": VERSION,
        "generated_by": "scripts/build_dataset.py",
        "representative_adult_age": REPRESENTATIVE_ADULT_AGE,
        "method": (
            "Sex-specific age-standardized BMI multiplied by sex-specific "
            "representative-cohort height squared, averaged equally across sexes."
        ),
        "warning": (
            "This is an ecological adult proxy, not individual protein intake "
            "and not an all-age population bodyweight estimate."
        ),
        "sources": sources,
    }

    csv_path = args.output_dir / "protein_bodyweight_country_year.csv"
    json_path = args.output_dir / "protein_bodyweight_country_year.json"
    result.to_csv(csv_path, index=False)

    normalized_result = result.astype(object).where(pd.notna(result), None)
    full_payload = {
        "metadata": metadata,
        "records": normalized_result.to_dict(orient="records"),
    }
    json_path.write_text(
        json.dumps(
            full_payload,
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        ),
        encoding="utf-8",
    )
    explorer_path = write_web_payload(result, metadata, args.output_dir)

    normalized = result["protein_supply_g_kg_day"].notna()
    gdp_mask = result["gdp_per_capita_ppp_2021"].notna()
    print(f"Wrote {len(result):,} country-year records")
    print(f"Normalized records: {normalized.sum():,}")
    print(
        "Countries with normalized data: "
        f"{result.loc[normalized, 'Code'].nunique():,}"
    )
    print(
        f"Years with normalized data: {result.loc[normalized, 'Year'].min()}–"
        f"{result.loc[normalized, 'Year'].max()}"
    )
    print(
        f"GDP observations: {gdp_mask.sum():,} across "
        f"{result.loc[gdp_mask, 'Code'].nunique():,} countries"
    )
    print(f"Browser payload: {explorer_path.stat().st_size / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
