// Builds the city and park layouts off the main thread and hands back the packed instance arrays,
// so thousands of buildings never cost the page a long task.

import { layoutCity, layoutLights, layoutTrees, packCity } from "./city.js";

const buildings = layoutCity();
const arrays = { ...packCity(buildings), trees: layoutTrees(), lights: layoutLights(buildings) };
postMessage(arrays, Object.values(arrays).map((array) => array.buffer));
