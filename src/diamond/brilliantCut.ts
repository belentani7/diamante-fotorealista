import * as THREE from 'three';

const DEG = Math.PI / 180;

export type FacetGroup = 'table' | 'star' | 'kite' | 'upper' | 'girdle' | 'main' | 'lower';

export interface Facet {
  name: string;
  group: FacetGroup;
  points: THREE.Vector3[];
}

export interface CutParams {
  tableRatio: number;
  crownHeight: number;
  pavilionDepth: number;
  girdleThickness: number;
  starLength: number;
  lowerGirdle: number;
  crownTilt: number;
  pavilionTilt: number;
}

export interface CutMetrics {
  tablePct: number;
  crownAngle: number;
  pavilionAngle: number;
  depthPct: number;
  girdlePct: number;
  starPct: number;
  lowerGirdlePct: number;
}

export interface CutResult {
  facets: Facet[];
  geometry: THREE.BufferGeometry;
  planes: Float32Array;
  planeCount: number;
  counts: Record<FacetGroup, number>;
  metrics: CutMetrics;
}

export const MAX_PLANES = 64;

export const DEFAULT_CUT: CutParams = {
  tableRatio: 0.57,
  crownHeight: 0.148,
  pavilionDepth: 0.44,
  girdleThickness: 0.028,
  starLength: 0.5,
  lowerGirdle: 0.75,
  crownTilt: 0,
  pavilionTilt: 0,
};

const girdleRadius = 1;

function radial(azDeg: number): THREE.Vector3 {
  const a = azDeg * DEG;
  return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
}

function tangent(azDeg: number): THREE.Vector3 {
  const a = azDeg * DEG;
  return new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
}

function at(azDeg: number, r: number, z: number): THREE.Vector3 {
  const a = azDeg * DEG;
  return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
}

function newell(points: THREE.Vector3[]): THREE.Vector3 {
  const n = new THREE.Vector3();
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  return n.normalize();
}

interface Plane {
  n: THREE.Vector3;
  c: number;
}

/**
 * Point on the ridge line shared by two adjacent facet planes at a requested
 * radius. All facet planes of the same family pass through one point on the
 * gem axis, so the mutual ridge is a straight line through that point; we solve
 * for the parameter that lands on the requested radius. Solving by radius keeps
 * the star points and pavilion junctions on the real stone proportions no
 * matter how strongly the families are tilted against each other.
 */
function ridgePointAtRadius(
  a: Plane,
  b: Plane,
  targetRadius: number,
  ridgeAzimuth: number,
): THREE.Vector3 | null {
  const raw = new THREE.Vector3().crossVectors(a.n, b.n);
  const lenSq = raw.lengthSq();
  if (lenSq < 1e-10) return null;

  const p0 = new THREE.Vector3()
    .crossVectors(b.n, raw)
    .multiplyScalar(a.c)
    .add(new THREE.Vector3().crossVectors(raw, a.n).multiplyScalar(b.c))
    .divideScalar(lenSq);

  const dir = raw.clone().normalize();
  const along = radial(ridgeAzimuth);
  const speed = dir.dot(along);
  if (Math.abs(speed) < 1e-6) return null;

  return p0.addScaledVector(dir, (targetRadius - p0.dot(along)) / speed);
}

export function buildBrilliantCut(params: CutParams = DEFAULT_CUT): CutResult {
  const R = girdleRadius;
  const rt = params.tableRatio;
  const zt = params.crownHeight * 2 * R;
  const depth = params.pavilionDepth * 2 * R;
  const zg = params.girdleThickness * R;
  const zBot = -zg;
  const zCul = -depth;
  const dz = zBot - zCul;

  const crownNorm = Math.hypot(zt, R - rt);
  const pavNorm = Math.hypot(dz, R);
  const cosC = Math.cos(params.crownTilt);
  const sinC = Math.sin(params.crownTilt);
  const cosP = Math.cos(params.pavilionTilt);
  const sinP = Math.sin(params.pavilionTilt);
  const up = new THREE.Vector3(0, 0, 1);

  const crownPlane = (az: number): Plane => {
    const w = radial(az).multiplyScalar(zt / crownNorm).addScaledVector(up, (R - rt) / crownNorm);
    return {
      n: w.multiplyScalar(cosC).addScaledVector(tangent(az), -sinC).normalize(),
      c: (cosC * zt * R) / crownNorm,
    };
  };

  const pavilionPlane = (az: number): Plane => {
    const w = radial(az).multiplyScalar(dz / pavNorm).addScaledVector(up, -R / pavNorm);
    return {
      n: w.multiplyScalar(cosP).addScaledVector(tangent(az), -sinP).normalize(),
      c: (-R * zCul) / pavNorm,
    };
  };

  const starRadius = rt + params.starLength * (R - rt);
  const junctionRadius = R * (1 - params.lowerGirdle);

  const table: THREE.Vector3[] = [];
  const star: THREE.Vector3[] = [];
  const junction: THREE.Vector3[] = [];
  const girdleTop: THREE.Vector3[] = [];
  const girdleBottom: THREE.Vector3[] = [];

  for (let m = 0; m < 8; m++) {
    const az = 45 * m;
    table.push(at(az, rt, zt));
    const s = ridgePointAtRadius(crownPlane(az), crownPlane(az + 45), starRadius, az + 22.5);
    if (!s) throw new Error('No se pudo resolver la cresta de la corona');
    star.push(s);
    const j = ridgePointAtRadius(
      pavilionPlane(az),
      pavilionPlane(az + 45),
      junctionRadius,
      az + 22.5,
    );
    if (!j) throw new Error('No se pudo resolver la cresta del pavimento');
    junction.push(j);
  }

  for (let k = 0; k < 16; k++) {
    const az = 22.5 * k;
    girdleTop.push(at(az, R, 0));
    girdleBottom.push(at(az, R, zBot));
  }

  const culet = new THREE.Vector3(0, 0, zCul);
  const facets: Facet[] = [{ name: 'table', group: 'table', points: table }];

  for (let m = 0; m < 8; m++) {
    const n = (m + 1) % 8;
    const p = (m + 7) % 8;
    facets.push({ name: `star-${m}`, group: 'star', points: [table[m], table[n], star[m]] });
    facets.push({
      name: `kite-${m}`,
      group: 'kite',
      points: [table[m], star[m], girdleTop[2 * m], star[p]],
    });
    facets.push({
      name: `upper-a-${m}`,
      group: 'upper',
      points: [girdleTop[2 * m], girdleTop[2 * m + 1], star[m]],
    });
    facets.push({
      name: `upper-b-${m}`,
      group: 'upper',
      points: [girdleTop[2 * m + 1], girdleTop[(2 * m + 2) % 16], star[m]],
    });
    facets.push({
      name: `main-${m}`,
      group: 'main',
      points: [culet, junction[m], girdleBottom[2 * m], junction[p]],
    });
    facets.push({
      name: `lower-a-${m}`,
      group: 'lower',
      points: [girdleBottom[2 * m], girdleBottom[2 * m + 1], junction[m]],
    });
    facets.push({
      name: `lower-b-${m}`,
      group: 'lower',
      points: [girdleBottom[2 * m + 1], girdleBottom[(2 * m + 2) % 16], junction[m]],
    });
  }

  for (let k = 0; k < 16; k++) {
    const n = (k + 1) % 16;
    facets.push({
      name: `girdle-${k}`,
      group: 'girdle',
      points: [girdleTop[k], girdleBottom[k], girdleBottom[n], girdleTop[n]],
    });
  }

  const interior = new THREE.Vector3();
  for (const facet of facets) {
    for (const point of facet.points) interior.add(point);
  }
  interior.divideScalar(facets.reduce((sum, f) => sum + f.points.length, 0));

  const positions: number[] = [];
  const normals: number[] = [];
  const traced: Plane[] = [];
  const counts = {
    table: 0,
    star: 0,
    kite: 0,
    upper: 0,
    girdle: 0,
    main: 0,
    lower: 0,
  };

  for (const facet of facets) {
    const normal = newell(facet.points);
    const centroid = new THREE.Vector3();
    for (const point of facet.points) centroid.add(point);
    centroid.divideScalar(facet.points.length);
    if (normal.dot(centroid.clone().sub(interior)) < 0) {
      facet.points.reverse();
      normal.negate();
    }

    counts[facet.group]++;

    if (facet.group !== 'girdle') {
      const d = normal.dot(facet.points[0]);
      const duplicate = traced.some(
        (plane) => plane.n.dot(normal) > 0.9999 && Math.abs(plane.c - d) < 1e-4,
      );
      if (!duplicate) traced.push({ n: normal.clone(), c: d });
    }

    for (let i = 1; i < facet.points.length - 1; i++) {
      const tri = [facet.points[0], facet.points[i], facet.points[i + 1]];
      for (const vertex of tri) {
        positions.push(vertex.x, vertex.y, vertex.z);
        normals.push(normal.x, normal.y, normal.z);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  const planeCount = Math.min(traced.length, MAX_PLANES);
  const planes = new Float32Array(MAX_PLANES * 4);
  for (let i = 0; i < planeCount; i++) {
    planes[i * 4 + 0] = traced[i].n.x;
    planes[i * 4 + 1] = traced[i].n.y;
    planes[i * 4 + 2] = traced[i].n.z;
    planes[i * 4 + 3] = traced[i].c;
  }

  const slant = (a: THREE.Vector3, b: THREE.Vector3) => a.distanceTo(b);
  const metrics: CutMetrics = {
    tablePct: (rt / R) * 100,
    crownAngle: Math.atan(zt / (R - rt)) / DEG,
    pavilionAngle: Math.atan(dz / R) / DEG,
    depthPct: ((zt + depth) / (2 * R)) * 100,
    girdlePct: (zg / R) * 100,
    starPct: (params.starLength * 100),
    lowerGirdlePct:
      (slant(girdleBottom[0], junction[0]) / slant(girdleBottom[0], culet)) * 100,
  };

  return { facets, geometry, planes, planeCount, counts, metrics };
}

let cached: CutResult | null = null;

export function getBrilliantCut(): CutResult {
  if (!cached) cached = buildBrilliantCut();
  return cached;
}