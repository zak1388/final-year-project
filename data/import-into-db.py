#!/bin/python3

import sys
import math
import glob
import csv
import sqlite3
from datetime import datetime
from multiprocessing import Process, Pool

db = sqlite3.connect("cycle-data.db")

OPERATIONS = {}

def register_operation():
    def wrapper(func):
        OPERATIONS[func.__name__] = func
        return func
    return wrapper

def parse_timestr(time_str) -> int:
    if not time_str:
        return 0

    dt = None
    try:
        if not dt:
            dt = datetime.strptime(time_str, "%d/%m/%Y %H:%M")
    except ValueError as e:
        pass

    try:
        if not dt:
            dt = datetime.strptime(time_str,  "%d-%m-%Y %H:%M")
    except ValueError as e:
        pass

    try:
        if not dt:
            dt = datetime.strptime(time_str,  "%d-%m-%Y %H:%M:%S")
    except ValueError as e:
        pass


    try:
        if not dt:
            dt = datetime.strptime(time_str,  "%Y-%m-%d %H:%M")
    except ValueError as e:
        pass


    # [parse_timestr] Unknown date format for str: 25/12/2015 13:27:00
    try:
        if not dt:
            dt = datetime.strptime(time_str,  "%d/%m/%Y %H:%M:%S")
    except ValueError as e:
        pass

    if not dt:
        print("[parse_timestr] Unknown date format for str:", time_str)
        return 0

    return int(dt.timestamp())

def csv_reader_to_rows(reader : csv.DictReader):
    errors = []
    rows = []
    try:
        # Rental Id,Duration,Bike Id,End Date,EndStation Id,EndStation Name,Start Date,StartStation Id,StartStation Name
        # 73768697,1620,7457,10/03/2018 12:41,807,"Bevington Road West, North Kensington",10/03/2018 12:14,647,"Richmond Way, Shepherd's Bush"

        if not rows:
            rows = [
                [
                    r["Rental Id"], r["Duration"], r["Bike Id"], 
                    parse_timestr(r["Start Date"]), r["StartStation Id"], r["StartStation Name"], 
                    parse_timestr(r["End Date"]), r["EndStation Id"], r["EndStation Name"]
                ] for r in reader
            ]
    except KeyError as e:
        errors.append(e)

    try:
        # Rental Id,Duration,Bike Id,End Date        ,EndStation Logical Terminal,EndStation Name   ,endStationPriority_id,Start Date        ,StartStation Logical Terminal,StartStation Name
        # 57834109 ,720     ,9392   ,31/08/2016 00:12,200077                     ,"Vicarage Crescent, Battersea"          ,0,31/08/2016 00:00,200237                       ,"Parson's Green , Parson's Green"
        if not rows:
            rows = [
                [
                    r["Rental Id"], r["Duration"], r["Bike Id"], 
                    parse_timestr(r["Start Date"]), r["StartStation Logical Terminal"], r["StartStation Name"], 
                    parse_timestr(r["End Date"]), r["EndStation Logical Terminal"], r["EndStation Name"]
                ] for r in reader
            ]
    except KeyError as e:
        errors.append(e)

    try:
        # Rental Id,Duration_Seconds,Bike Id,End Date,End Station Id,End Station Name,Start Date,Start Station Id,Start Station Name
        # 69016592,6480,1139,01/09/2017 17:06,501,"Cephas Street, Bethnal Green",01/09/2017 15:18,485,"Old Ford Road, Bethnal Green"
        if not rows:
            rows = [
                [
                    r["Rental Id"], r["Duration_Seconds"], r["Bike Id"], 
                    parse_timestr(r["Start Date"]), r["Start Station Id"], r["Start Station Name"], 
                    parse_timestr(r["End Date"]), r["End Station Id"], r["End Station Name"]
                ] for r in reader
            ]
    except KeyError as e:
        errors.append(e)



    try:
        # "Number"   ,"Start date"      ,"Start station number","Start station"               ,"End date"        ,"End station number","End station"               ,"Bike number"  ,"Bike model" ,"Total duration","Total duration (ms)"
        # "138260425","2024-03-31 23:59","001113"              ,"Trebovir Road , Earl's Court","2024-04-01 00:24","001210"            ,"Nevern Place, Earl's Court","58638"        ,"CLASSIC"    ,"25m 44s"       ,"1544094"
        if not rows:
            rows = [
                [
                    r["Number"], (r["Total duration (ms)"] or "0000")[:-3], r["Bike number"], 
                    parse_timestr(r["Start date"]), r["Start station number"], r["Start station"], 
                    parse_timestr(r["End date"]), r["End station number"], r["End station"]
                ] for r in reader
            ]
    except KeyError as e:
        print(f"[csv_reader_to_rows] missing schema: {reader.__next__().keys()}")
        errors.append(e)
        print(errors)

    return rows

def import_usage_stat(file_name):
    with open(file_name, "r", newline="") as f:
        reader = csv.DictReader(f)
        
        rows = csv_reader_to_rows(reader)
        if not rows:
            print("[import_usage_stat]", file_name, "failed")
            return []

        return rows

@register_operation()
def usage_stats():
    cur = db.execute("""
        CREATE TABLE IF NOT EXISTS usage_stats (
            RentalID INT,
            Duration INT,
            BikeID INT,

            StartDate INT,
            StartStationID INT,
            StartStation NAME,

            EndDate INT,
            EndStationID INT,
            EndStation NAME,
            PRIMARY KEY (RentalID)
        );
   """);

    stmt = """
        INSERT INTO usage_stats 
        ( 
            RentalID, Duration, BikeID, 
            StartDate, StartStationID, StartStation, 
            EndDate, EndStationID, EndStation
        )
        VALUES
        ( 
            ?, ?, ?,    
            ?, ?, ?,    
            ?, ?, ?
        );
    """

    path = "downloaded/usage-stats/"
    file_names = glob.glob(path + "*.csv")

    with Pool(processes=4) as pool:
        res = pool.imap(import_usage_stat, file_names)
        for rows in res:
            try:
                cur.executemany(stmt, rows)
            except sqlite3.IntegrityError as e:
                print(e)
    
    db.commit()

TIME_DELTA = 15 * 60 # Time periods in seconds
SECONDS_PER_DAY = 24 * 60 * 60
TIMES = [{"start_time": TIME_DELTA * i, "end_time": TIME_DELTA * (i + 1)} for i in range(math.ceil(SECONDS_PER_DAY / TIME_DELTA))]

@register_operation()
def connection_stats():
    connection_stats_out()
    connection_stats_in()

@register_operation()
def connection_stats_out():
    cur = db.execute("""
        CREATE TABLE IF NOT EXISTS connection_stats_out (
            StationID INT, 
            TimeStart INT,
            CountOut INT,
            PRIMARY KEY (StationID, TimeStart)
        );
    """)

    stmt = f"""
            INSERT INTO connection_stats_out (StationID, CountOut, TimeStart)
            SELECT 
                StartStationID, 
                count(StartStationID), 
                (:start_time)
            FROM usage_stats
            WHERE ((StartDate % {SECONDS_PER_DAY}) / {TIME_DELTA}) * {TIME_DELTA} = (:start_time)
            GROUP BY StartStationID;
    """
    try: 
        cur.executemany(stmt, TIMES)
        db.commit()
    except sqlite3.Error as error:
        raise Exception("Statement with error: " + stmt + "\n\n" + str(error))

@register_operation()
def connection_stats_in():
    cur = db.execute("""
        CREATE TABLE IF NOT EXISTS connection_stats_in (
            StationID INT, 
            TimeEnd INT,
            CountIn INT,
            PRIMARY KEY (StationID, TimeEnd)
        );
    """)

    stmt = f"""
            INSERT INTO connection_stats_in (StationID, CountIn, TimeEnd)
            SELECT 
                EndStationID, 
                count(EndStationID), 
                (:end_time)
            FROM usage_stats
            WHERE ((EndDate % {SECONDS_PER_DAY}) / {TIME_DELTA}) * {TIME_DELTA} = (:end_time)
            GROUP BY EndStationID;
    """
    try: 
        cur.executemany(stmt, TIMES)
        db.commit()
    except sqlite3.Error as error:
        raise Exception("Statement with error: " + stmt + "\n\n" + str(error))



USAGE_TEXT = f"Usage: {sys.argv[0]} OPERATION...\nOPERATION in {list(OPERATIONS.keys())}..."
def main():
    if len(sys.argv) < 2:
        print("Missing required argument(s) operation", file=sys.stderr)
        print(USAGE_TEXT, file=sys.stderr)
        exit(1)

    supplied_operations = sys.argv[1:]

    invalid_operations = [op for op in supplied_operations if op not in OPERATIONS.keys()] # filter(lambda op: not op in list(OPERATIONS.keys()), supplied_operations)
    if len(invalid_operations) > 0:
        print("Invalid operations:", list(invalid_operations), file=sys.stderr)
        print(USAGE_TEXT, file=sys.stderr)
        exit(1)

    for op in supplied_operations:
        OPERATIONS[op]()
    
if __name__ == "__main__":
    main()
