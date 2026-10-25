// Walkers: vertex colours with a soft top light; aGlow marks parts that shine at night.

attribute vec3 color;
attribute float aGlow;

varying vec3 vColor;
varying float vLight;
varying float vGlow;

void main()
{
    vColor = color;
    vGlow = aGlow;
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
    vLight = 0.6 + 0.4 * smoothstep(-0.4, 1.0, worldNormal.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
