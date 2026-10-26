// Passes the canopy's baked day and night vertex colours to the fragment shader.

attribute vec3 dayColor;
attribute vec3 nightColor;

varying vec3 vDayColor;
varying vec3 vNightColor;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vDayColor = dayColor;
    vNightColor = nightColor;
}
