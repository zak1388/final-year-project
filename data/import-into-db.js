import sqlite3 from "sqlite3";
import fs_promise from "node:fs/promises";
import fs_sync from "node:fs";

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
    
    db.run(`CREATE TABLE IF NOT EXISTS cycle_parking (
        ID VARCHAR(16), 
        Latitude REAL, 
        Longitude REAL,
        PRIMARY KEY (ID)
    );`) 

    const cycle_parking_json = fs_sync.readFileSync("downloaded/CyclingInfrastructure/data/points/cycle_parking.json");
    const cycle_parking = JSON.parse(cycle_parking_json);
    
    const stmt_str = `INSERT INTO cycle_parking (ID, Latitude, Longitude) VALUES `
    const sql_values = cycle_parking.features.map(feature => `("${feature.properties.FEATURE_ID}", ${feature.geometry.coordinates[0]}, ${feature.geometry.coordinates[1]})`).join(", ");

    db.run(stmt_str + sql_values + ";");
}

function import_all() {
    // import_active_counts();
    // import_counters();
    // // import_cycle_parking();
    // import_cyle_routes();
    import_cycling_infrastructure();
    // import_usage_stats();
}

import_all();
