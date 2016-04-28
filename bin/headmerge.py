#!/usr/bin/env python
"""Merge data files and only keep the header line for the first file."""
import argparse
import sys


def main(files):
    header_seen = False
    for filename in sorted(files):
        with open(filename) as fh:
            linenum = 0
            for line in fh:
                if linenum == 0:
                    if not header_seen:
                        sys.stdout.write(line)
                        header_seen = True
                else:
                    sys.stdout.write(line)
                linenum += 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="""Merge data files. Only keep the header line for the
        first file. File names are sorted before merging.""")
    parser.add_argument("files", nargs="*",
        help="Data files with identical one line headers.")
    args = parser.parse_args()
    main(args.files)
