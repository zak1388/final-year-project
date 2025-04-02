import sqlite3 from "sqlite3";
import fs_promise from "node:fs/promises";
import fs_sync from "node:fs";
import { parse } from "csv-parse";

const db = new sqlite3.Database("cycle-data.db");

// TODO: in progress
function import_cycling_infrastructure() {
    // import_asls();
    // import_crossings();
    // import_lanes();
    import_parking();
    // import_restricted_points();
    // import_restricted_routes();
    // import_signs();
    // import_traffic_calming();
}

function import_parking() {
    // TODO: might want to include more columns
    
    db.exec(`CREATE TABLE IF NOT EXISTS cycle_parking (
        ID VARCHAR(16), 
        Latitude REAL, 
        Longitude REAL,
        PRIMARY KEY (ID)
    );`);
    

    const cycle_parking_json = fs_sync.readFileSync("downloaded/CyclingInfrastructure/data/points/cycle_parking.json");
    const cycle_parking = JSON.parse(cycle_parking_json);
    
    const stmt_str = `INSERT INTO cycle_parking (ID, Latitude, Longitude) VALUES `
    const sql_values = cycle_parking.features.map(feature => `("${feature.properties.FEATURE_ID}", ${feature.geometry.coordinates[0]}, ${feature.geometry.coordinates[1]})`).join(", ");

    db.exec(stmt_str + sql_values + ";");
}

async function import_usage_stats() {
    db.exec(`CREATE TABLE IF NOT EXISTS usage_stats (
        RentalID INT,
        Duration INT,
        BikeID INT,

        StartDate DATETIME,
        StartStationID INT,
        StartStation NAME,

        EndDate DATETIME,
        EndStationID INT,
        EndStation NAME,
        PRIMARY KEY (RentalID)
    );`);

    const base_dir = "downloaded/usage-stats";
    const regex = new RegExp("^.*\.csv$");
    const usage_stats_files = fs_sync.readdirSync(base_dir)
        .filter(file => {
            let r = regex.test(file);
            return r;
        })
        .map(file => base_dir + "/" + file);



    console.log("[usage_stats] Processing " + usage_stats_files.length + " files");

    const insert_stmt = `INSERT INTO usage_stats ( RentalID, Duration, BikeID, StartDate, StartStationID, StartStation, EndDate, EndStationID, EndStation ) VALUES `;

    let failed = 0;
    let completed = 0;
    const sql_imports = usage_stats_files.map(async (file) => {
        try {
            const parser = fs_sync.createReadStream(file)
                             .pipe(parse({ 
                                 skip_records_with_error: true,
                                 columns: true,
                             }));
            for await (const r of parser) {
                const insert_record_stmt = insert_stmt 
                    + `("${r["Rental Id"]}", "${r["Duration"]}", "${r["Bike Id"]}", "${r["Start Date"]}", "${r["StartStation Id"]}", "${r["StartStation Name"]}", "${r["End Date"]}", "${r["EndStation Id"]}", "${r["EndStation Name"]}");`;
                db.exec(insert_record_stmt, (null_or_err) => { if (null_or_err) throw {err: null_or_err, insert_record_stmt, record: r, file}; });
            }
            parser.end();

            console.log(`[usage_stats] ${++completed}/${usage_stats_files.length} completed`);
        } catch (e) {
            failed++;
            console.error("[usage-stats] Failed to read file \"" + file + "\"", e)
        }
    });

    await Promise.all(sql_imports);

    if (failed > 0) console.warn("[usage-stats] Failed to process " + failed + " files");
    console.log(`[usage_stats] Finished: ${completed}/${usage_stats_files.length} completed`);
}

function import_all() {
    // import_active_counts();
    // import_counters();
    // import_cyle_routes();
    // import_cycling_infrastructure();
    import_usage_stats().then(() => {
        console.log("[import_all]: closing db");
        db.close();
        console.log("[import_all]: closed db");
    });

}

import_all();
