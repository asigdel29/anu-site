// Puts the unit sky sphere on the far plane around the camera: only the camera's rotation applies,
// so the sky never moves when the camera does, and everything else draws in front of it.

varying vec3 vDirection;

void main()
{
    vDirection = position;
    vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
    gl_Position = clip.xyww;
}
