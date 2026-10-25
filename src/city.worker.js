// Builds the city layout off the main thread and hands back the packed instance arrays,
// so thousands of buildings never cost the page a long task.

import { layoutCity, packCity } from "./city.js";

const arrays = packCity(layoutCity());
postMessage(arrays, Object.values(arrays).map((array) => array.buffer));
