#!/usr/bin/env python
import sys

if len(sys.argv) > 1:
    files = sys.argv[1:]
else:
    sys.exit(0)

header_seen = False
for filename in files:
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
