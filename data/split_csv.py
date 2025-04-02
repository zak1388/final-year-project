#!/bin/python3

# based on https://stackoverflow.com/a/20721203

import sys
import subprocess
import glob

MAX_LINES=10000

def main():
    if len(sys.argv) != 2:
        print("USAGE:", sys.argv[0], "<csv file>")

    filename = sys.argv[1]

    header = subprocess.check_output(["head", "-n", "1", filename]).decode("utf-8")

    pipe = subprocess.Popen(("tail", "-n", "+2", filename), stdout=subprocess.PIPE)
    subprocess.check_call(["split", "-l", str(MAX_LINES), "-", filename + "_split_"], stdin=pipe.stdout)

    for split_file in glob.glob(f"{filename}_split_*"):
        subprocess.check_call(["sed", "-i", "-e", "1i" + header, split_file])


if __name__ == "__main__":
    main()
