// Builds the city and park layouts off the main thread and hands back the packed instance arrays,
// so thousands of buildings never cost the page a long task.

import { buildCityArrays } from "./city.js";

const arrays = buildCityArrays();
postMessage(arrays, Object.values(arrays).map((array) => array.buffer));
