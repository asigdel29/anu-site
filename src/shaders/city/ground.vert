// The street-level disc under the city; passes city-space and world positions.

varying vec3 vCity;
varying vec3 vWorld;

void main()
{
    vCity = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}
