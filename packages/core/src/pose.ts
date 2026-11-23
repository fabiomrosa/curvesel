/** A row-major 3×3 rotation matrix: its columns are where the Slide's own x, y and z axes point. */
export type Rotation = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** Where a Slide is: its position in px relative to the centre of the Stage, and its rotation. */
export interface Pose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: Rotation;
}
