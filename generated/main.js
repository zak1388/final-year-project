import './style.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import Overlay from "ol/Overlay.js";
import {useGeographic} from "ol/proj.js";

useGeographic();

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM()
    })
  ],
  view: new View({
    center: [-0.2, 51.50],
    zoom: 10
  })
});

function map_contains(point_w_latlon) {
    let [x_pixel, y_pixel] = map.getPixelFromCoordinate([point_w_latlon.Latitude, point_w_latlon.Longitude]);
    if (x_pixel < 0 || x_pixel > map.getSize()[0]) {
        return false;
    } else if (y_pixel < 0 || y_pixel > map.getSize()[1]) {
        return false;
    }
    return true;
}

let drawn_cycle_parking = [];
function draw_cycle_parking(cycle_parking, max_count) {
    const count_inside = cycle_parking.reduce((sum_inside, parking_spot) => {
        const c = map_contains(parking_spot);
        return sum_inside +  (c ? 1 : 0);
    }, 0);

    if (count_inside > max_count) {
        drawn_cycle_parking.forEach(parking_element => {
            parking_element.style.display = "none";
        });
        return;
    }


    let count = 0;
    for (const parking_spot of cycle_parking) {
        if (!map_contains(parking_spot)) {
            continue;
        }
    
        let element;
        if (drawn_cycle_parking.length <= count) {
            element = document.createElement("div");
            element.id = parking_spot.ID;

            element.marker = document.createElement("marker");
            element.marker.style.width = "10px";
            element.marker.style.height = "10px";
            element.marker.style.borderRadius = "5px";
            element.marker.style.backgroundColor = "red";
            element.marker.style.opacity = "0.5";
            element.marker.style.display = "block";
            element.appendChild(element.marker);

            element.label = document.createElement("div");
            element.label.innerHTML = parking_spot.ID;
            element.label.style.display = "none";
            element.label.style.backgroundColor = "white";
            element.label.style.border = "1px solid black";
            element.addEventListener("mouseenter", () => element.label.style.display = "block");
            element.addEventListener("mouseout", () => element.label.style.display = "none");
            element.appendChild(element.label);

            drawn_cycle_parking.push(element);
        } else {
            element = drawn_cycle_parking[count];
            element.id = parking_spot.ID;
            element.style.display = "block";
            element.label.innerHTML = parking_spot.ID;
        }

        map.addOverlay(new Overlay({
            position: [parking_spot.Latitude, parking_spot.Longitude],
            element: element
        }));

        count++;
    }
}

let cycle_parking = null;
async function get_cycle_parking() {
    const cycle_parking_raw = await fetch("/api/cycle_parking");
    cycle_parking = await cycle_parking_raw.json();
    let max_count = 500;
    map.addEventListener("moveend", () => draw_cycle_parking(cycle_parking, max_count));
    draw_cycle_parking(cycle_parking, max_count);
}

get_cycle_parking();

map.addEventListener("click", (e) => console.log(e));
