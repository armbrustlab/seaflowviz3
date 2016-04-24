#!/usr/bin/env python
"""Replace cruise name fields in stat.csv or sfl.csv."""
import argparse
import sys


def csv_replace_cruise(cruise, csv_in, csv_out):
    """Replace cruise name in csv file.

    Args:
        cruise: Replacement cruise field name
        csv_in: Input CSV file path. File should have cruise name in "cruise"
            column.
        csv_out: Output CSV file path
    """
    with open(csv_in) as fin:
        with open(csv_out, "w") as fout:
            lines = fin.readlines()
            header = lines[0].rstrip().split(",")
            cruise_index = header.index("cruise")
            fout.write(lines[0])
            i = 0
            for line in lines[1:]:
                fields = line.rstrip().split(",")

                # Replace cruise name
                if cruise:
                    fields[cruise_index] = cruise

                fout.write(",".join(fields) + "\n")
                i += 1


if __name__ == "__main__":
    p = argparse.ArgumentParser(
        description="""Replace cruise name fields in stat.csv or sfl.csv""")
    p.add_argument("cruise", help="""Replacement cruise name csv file""")
    p.add_argument("input", help="""Input csv file""")
    p.add_argument("output", help="""Output csv file""")
    args = p.parse_args()

    csv_replace_cruise(args.cruise, args.input, args.output)
