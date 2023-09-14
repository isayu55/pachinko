const textX = document.getElementById('text-x');
const textV = document.getElementById('text-v');
const info = document.getElementById('info');
const pointInfo = document.getElementById('pointInfo');
const canvas = document.getElementById('myCanvas');

const BOARDWIDTH = 400;
const BOARDHEIGHT = 600;
const BOARDDEPTH = 10;

const FLAMEDEPTH = 50;
const FLAMEWIDTH = 10;      // 枠の幅
// ばねの下の板と仕切りの厚み
const PARTITION = 10;
const PLANK = 10;
const GAP = 5;        // 仕切りの幅

const BALL_R = 25;          // ボールの半径 (mm)

const OBJ_R = 20;           // 障害物の半径 (mm)

const GOAL_NUM = 2;         // ゴールの数
const GOAL_THICKNESS = 10;       // ゴールの厚さ
const GOAL_HEIGHT = BALL_R * 2; // ゴールの高さ
const BIG_GOAL_WIDTH = BALL_R * 4; // 大きいゴールの幅
const BIG_GOAL_POINTS = 100; // 大きいゴールのポイント
const BIG_GOAL_V0 = 100;     // 大きいゴールの速度
const SMALL_GOAL_WIDTH = BALL_R * 3; // 小さいゴールの幅
const SMALL_GOAL_POINTS = 500; // 小さいゴールのポイント
const SMALL_GOAL_V0 = 130;  // 大きいゴールの速度

const SPRING_M = 0.005; // ばねの質量 (kg)
const SPRING_MIN = 50;  // ばねの長さの最小値
const EDGE_R = 120; // 角の弧の半径
const G = -1702;  // 重力加速度 10度 (mm/s^2)
const E = 0.8;      // 反発係数
const K = 17.02;        // ばね定数 (N/mm)
const L = 150;      // ばねの自然長 (mm)
const STEP = 1 / 60; // 時間刻み幅 (s)
const TIME_0 = 30;  // 制限時間
const COUNTDOWN_0 = 5;

const MOUSEX_GAP = 10;  // マウスのx座標のずれ
const TOUCHX_GAP = 60;  // タッチ操作のx座標のずれ
const TOUCHY_GAP = 20;  // タッチ操作のy座標のずれ

const MAX_DATA = 150;   // 配列の最大サイズ
const LEFTEDGE = -BOARDWIDTH / 2 + FLAMEWIDTH;
const DOWNEDGE = -BOARDHEIGHT / 2 + FLAMEWIDTH;
const RIGHTEDGE = BOARDWIDTH / 2 - FLAMEWIDTH;
const UPEDGE = BOARDHEIGHT / 2 - FLAMEWIDTH;
let obj = [];   // 障害物オブジェクト

let ball;           // ボール
let ballM = 0.01;          // ボールの質量
let spring;         // ばね
let objNum = 3;             // 障害物の数
let objNumBefore = 0;
let objs = [objNum];      // 障害物の数
let goals = [GOAL_NUM];    // ゴールの数
let time;           // 経過時間 (s)
let shot;           // 発射されたときのフラグ
let edge;           // 角に衝突したときの変数
let over;           // マウスオーバーフラグ
let goalTime;       // ボールがゴールに収まっている時間
let goalFlagSum;    // ゴールフラグの合計
let bigGoalV;       // 大きいゴールの速さ
let smallGoalV;     // 小さいゴールの速さ
let fallTime;       // 画面外にいる時間
let move;           // アニメーション稼働フラグ
let points;         // ポイント
let game;           // ゲーム開始フラグ
let goalFlag;       // ゴール稼働フラグ
let y = 0;          // ばねの縮み
let flag;           // 動作確認用フラグ
let countDown;      // カウントダウン秒数
let ballYBefore;    // 前回発射したときの縮み
let finishAfterTime; //終了後の時間
let goalAfterTime;   // ゴール後の時間

let xData, yData;   // 座標データ配列

let anime;            // アニメーションフラグ
let animeOnce;        // 1ステップアニメーションフラグ
let drag = false;     // マウスドラッグフラグ
let ballPath = [];

const renderer = new THREE.WebGLRenderer({ canvas }); // レンダラの作成
const scene = new THREE.Scene();                    // シーンの作成

const HEIGHTMAX = BOARDHEIGHT - FLAMEWIDTH * 2;
const WIDTHMAX = BOARDWIDTH - FLAMEWIDTH * 2;
const X0 = LEFTEDGE + BALL_R * 2 + PARTITION + GAP;

const rect = canvas.getBoundingClientRect();
const textInfo = document.getElementById('textInfo');
textInfo.style.top = rect.top + canvas.height / 2 - 60 + 'px';
textInfo.style.left = rect.left + canvas.width / 2 - 10 + 'px';
const pointText = document.getElementById('pointText');
pointText.style.top = rect.top + canvas.height / 2 - 160 + 'px';


// ばね
spring = { y: L - (ballM + SPRING_M) * G / K, v: 0, yPrev: L - (ballM + SPRING_M) * G / K, vPrev: 0 };

textX.innerHTML = (L - spring.y).toFixed(1) + " [mm]";

// カメラの作成
const camera = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, 0.1, 3000);
camera.position.set(0, -400, 1200);
camera.lookAt(new THREE.Vector3(0, 0, 0));

// カメラコントローラを作成
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.2;

// オイラー法
const euler = (x, y, h, k) => {
  return y + h * (x + k);
}
// ルンゲ・クッタ法
const runge_kutta = (x, y, h) => {
  let k1, k2, k3, k4;
  k1 = euler(x, 0, h, 0);
  k2 = euler(x, 0, h / 2, k1 / 2);
  k3 = euler(x, 0, h / 2, k2 / 2);
  k4 = euler(x, 0, h, k3);
  return y + (k1 + 2 * k2 + 2 * k3 + k4) / 6;
}

// ボールの速度ベクトルが障害物に向かっているか
const collisionCheck = (by, oy, v) => {
  if (oy - by > 0) {
    if (v > 0) {
      return true;
    } else {
      return false;
    }
  } else {
    if (v < 0) {
      return true;
    } else {
      return false;
    }
  }
}
// 平面の作成
const floorGeometry = new THREE.BoxGeometry(BOARDWIDTH * 2, BOARDHEIGHT * 2, 1);
const floorMaterial = new THREE.MeshPhongMaterial({ color: "White" });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.position.z = -43 - 300 * Math.cos(10 * Math.PI / 180) * Math.sin(10 * Math.PI / 180) / 2;
floor.rotation.set(-10 * Math.PI / 180, 0, 0);
scene.add(floor);

const planeGeometry = new THREE.PlaneGeometry(BOARDWIDTH - FLAMEWIDTH * 2, BOARDHEIGHT - FLAMEWIDTH * 2, 1, 1);
const planeMaterial = new THREE.MeshPhongMaterial({ color: "LightYellow" });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
scene.add(plane);


// 球の作成
const sphereGeometry = new THREE.SphereGeometry(BALL_R, 30, 30);
const sphereMaterial = new THREE.MeshPhongMaterial({ color: 'red' });
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(LEFTEDGE + BALL_R, DOWNEDGE + L - (ballM + SPRING_M) * G / K + PLANK + BALL_R, BALL_R);
scene.add(sphere);

// 前回発射位置の球を作成
const sphereBeforeGeometry = new THREE.SphereGeometry(BALL_R - 2, 30, 30);
const sphereBeforeMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
const sphereBefore = new THREE.Mesh(sphereBeforeGeometry, sphereBeforeMaterial);
sphereBefore.position.set(LEFTEDGE + BALL_R, DOWNEDGE + L - (ballM + SPRING_M) * G / K + PLANK + BALL_R, BALL_R);
scene.add(sphereBefore);

// 枠の作成
const frame1Geometry = new THREE.BoxGeometry(BOARDWIDTH, FLAMEWIDTH, BOARDDEPTH + FLAMEDEPTH);
const frameMaterial = new THREE.MeshPhongMaterial({ color: "BurlyWood" });
const frame1 = new THREE.Mesh(frame1Geometry, frameMaterial);
frame1.position.set(0, BOARDHEIGHT / 2 - FLAMEWIDTH / 2, FLAMEDEPTH / 2 - BOARDDEPTH);

const frame2Geometry = new THREE.BoxGeometry(BOARDWIDTH, FLAMEWIDTH, 10);
const frame2Material = new THREE.MeshBasicMaterial({ color: "BurlyWood" });
const frame2 = new THREE.Mesh(frame2Geometry, frame2Material);
frame2.position.set(0, -BOARDHEIGHT / 2 + FLAMEWIDTH / 2, 40);

const frame3Geometry = new THREE.BoxGeometry(FLAMEWIDTH, BOARDHEIGHT, BOARDDEPTH + FLAMEDEPTH);
const frame3 = new THREE.Mesh(frame3Geometry, frameMaterial);
frame3.position.set(-BOARDWIDTH / 2 + FLAMEWIDTH / 2, 0, FLAMEDEPTH / 2 - BOARDDEPTH);

const frame4 = new THREE.Mesh(frame3Geometry, frameMaterial);
frame4.position.set(BOARDWIDTH / 2 - FLAMEWIDTH / 2, 0, FLAMEDEPTH / 2 - BOARDDEPTH);

scene.add(frame1);
scene.add(frame2);
scene.add(frame3);
scene.add(frame4);

// 台の作成
const createStand = () => {
  const standGeometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -BOARDWIDTH / 2, BOARDHEIGHT / 2, -BOARDDEPTH,
    -BOARDWIDTH / 2, -BOARDHEIGHT / 2, -BOARDDEPTH,
    -BOARDWIDTH / 2, -BOARDHEIGHT / 2 + BOARDHEIGHT * Math.pow(Math.cos(10 * Math.PI / 180), 2), -BOARDDEPTH - BOARDHEIGHT * Math.cos(10 * Math.PI / 180) * Math.sin(10 * Math.PI / 180),
    BOARDWIDTH / 2, BOARDHEIGHT / 2, -BOARDDEPTH,
    BOARDWIDTH / 2, -BOARDHEIGHT / 2, -BOARDDEPTH,
    BOARDWIDTH / 2, -BOARDHEIGHT / 2 + BOARDHEIGHT * Math.pow(Math.cos(10 * Math.PI / 180), 2), -BOARDDEPTH - BOARDHEIGHT * Math.cos(10 * Math.PI / 180) * Math.sin(10 * Math.PI / 180),
  ]);

  const indices = [
    0, 2, 1,
    0, 1, 4,
    0, 4, 3,
    3, 4, 5,
    1, 2, 5,
    1, 5, 4,
    2, 0, 5,
    0, 3, 5,
  ];

  standGeometry.setIndex(indices);
  standGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  const standMaterial = new THREE.MeshBasicMaterial({ color: "Tan" });
  const stand = new THREE.Mesh(standGeometry, standMaterial);
  scene.add(stand);
}
createStand();

//　エッジ作成
// ジオメトリ作成
const createEdge = () => {
  const edgeObjGeometry = new THREE.BufferGeometry();
  const edgeObj2Geometry = new THREE.BufferGeometry();
  const vertices = [];
  const vertices2 = [];
  const faces = [];
  const faces2 = []
  // 頂点取得
  for (i = 0; i < 2; i++) {
    vertices.push(new THREE.Vector3(LEFTEDGE, UPEDGE, i * FLAMEDEPTH));
    vertices2.push(new THREE.Vector3(RIGHTEDGE, UPEDGE, i * FLAMEDEPTH));
    for (let j = 0; j < 10; j++) {
      vertices.push(new THREE.Vector3(LEFTEDGE + EDGE_R - EDGE_R * Math.cos(10 * j * Math.PI / 180), UPEDGE - EDGE_R + EDGE_R * Math.sin(10 * j * Math.PI / 180), i * FLAMEDEPTH));
      vertices2.push(new THREE.Vector3(RIGHTEDGE - EDGE_R + EDGE_R * Math.sin(10 * j * Math.PI / 180), UPEDGE - EDGE_R + EDGE_R * Math.cos(10 * j * Math.PI / 180), i * FLAMEDEPTH));
    }
  }

  // 面取得
  faces.push(0, 1, 11);
  faces.push(1, 12, 11);
  faces.push(0, 11, 10);
  faces.push(10, 11, 21);
  faces2.push(0, 1, 11);
  faces2.push(1, 12, 11);
  faces2.push(0, 11, 10);
  faces2.push(10, 11, 21);
  for (i = 0; i < 9; i++) {
    faces.push(i + 1, i + 2, i + 12);
    faces.push(i + 12, i + 2, i + 13);
    faces2.push(i + 1, i + 2, i + 12);
    faces2.push(i + 12, i + 2, i + 13);
  }
  for (i = 0; i < 9; i++) {
    faces.push(0, i + 2, i + 1);
    faces2.push(0, i + 2, i + 1);
  }
  for (i = 0; i < 9; i++) {
    faces.push(11, 12 + i, 13 + i);
    faces2.push(11, 12 + i, 13 + i);
  }
  edgeObjGeometry.setFromPoints(vertices);
  edgeObjGeometry.setIndex(faces);
  edgeObj2Geometry.setFromPoints(vertices2);
  edgeObj2Geometry.setIndex(faces2);

  // メッシュ作成
  edgeObjMaterial = new THREE.MeshPhongMaterial({ color: "BurlyWood" });
  const edgeObj = new THREE.Mesh(edgeObjGeometry, edgeObjMaterial);
  const edgeObj2 = new THREE.Mesh(edgeObj2Geometry, edgeObjMaterial);

  scene.add(edgeObj);
  scene.add(edgeObj2);
}
createEdge();

// 仕切り作成
const partitionGeometry = new THREE.BoxGeometry(PARTITION, BOARDHEIGHT - BALL_R * 2 - FLAMEWIDTH * 2, FLAMEDEPTH);
const partitionMaterial = new THREE.MeshPhongMaterial({ color: "BurlyWood" });
const partition = new THREE.Mesh(partitionGeometry, partitionMaterial);
partition.position.set(X0 - PARTITION / 2, DOWNEDGE + (BOARDHEIGHT - BALL_R * 2 - FLAMEWIDTH * 2) / 2, FLAMEDEPTH / 2);
scene.add(partition);

// ばねの作成
const springObjGeometry = new THREE.TorusGeometry(15, 2, 10, 30, Math.PI * 2);
const springObjMaterial = new THREE.MeshPhongMaterial({ color: 'silver' });
const springObj = [10];
for (let i = 0; i < 10; i++) {
  springObj[i] = new THREE.Mesh(springObjGeometry, springObjMaterial);
  springObj[i].rotation.set(-Math.PI / 2, 0, 0)
  springObj[i].position.set(LEFTEDGE + BALL_R, DOWNEDGE + (L - (ballM + SPRING_M) * G / K) * i / 10 + 5, BALL_R);
  scene.add(springObj[i])
}
const springObj2Geometry = new THREE.CylinderGeometry(2, 2, L - (ballM + SPRING_M) * G / K, 10, 1, true, 0, Math.PI * 2);
const springObj2Material = new THREE.MeshPhongMaterial({ color: 'silver' });
const springObj2 = new THREE.Mesh(springObj2Geometry, springObj2Material);
springObj2.position.set(LEFTEDGE + BALL_R, DOWNEDGE + (L - (ballM + SPRING_M) * G / K) / 2, BALL_R);
scene.add(springObj2);

// ばね下の板作成
const springPlankGeometry = new THREE.BoxGeometry(BALL_R * 2, PLANK, BALL_R * 2);

const springPlankMaterial = new THREE.MeshPhongMaterial({ color: "Moccasin" });
const springPlank = new THREE.Mesh(springPlankGeometry, springPlankMaterial);
springPlank.position.set(LEFTEDGE + BALL_R, DOWNEDGE + L - (ballM + SPRING_M) * G / K + PLANK / 2, BALL_R);

scene.add(springPlank);

// 障害物作成
obj = [];
const objGeometry = new THREE.CylinderGeometry(OBJ_R, OBJ_R, FLAMEDEPTH, 20, 1, false, 0, Math.PI * 2);
const objMaterial = new THREE.MeshPhongMaterial({ color: "RosyBrown" });
for (let i = 0; i < objNum; i++) {
  obj[i] = new THREE.Mesh(objGeometry, objMaterial);
  obj[i].rotation.set(Math.PI / 2, 0, 0);
}

for (let i = 0; i < objNum; i++) {
  let count = 0;
  let tmpX = Math.floor(Math.random() * (RIGHTEDGE - BALL_R * 4 - OBJ_R * 2 - X0 - GAP * 2 + 1)) + X0 + BALL_R * 2 + OBJ_R + GAP;
  let tmpY = Math.floor(Math.random() * (UPEDGE - (DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4 + EDGE_R) + 1)) + DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4;
  for (let j = 0; j < i; j++) {
    if (Math.hypot(objs[j].x - tmpX, objs[j].y - tmpY) < (objs[j].r + OBJ_R + BALL_R * 2 + GAP)) {
      tmpX = Math.floor(Math.random() * (RIGHTEDGE - BALL_R * 4 - OBJ_R * 2 - X0 - GAP * 2 + 1)) + X0 + BALL_R * 2 + OBJ_R + GAP;
      tmpY = Math.floor(Math.random() * (UPEDGE - (DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4 + EDGE_R) + 1)) + DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4;
      j = -1;
      count++;
      if (count > 50) {
        i = -1;
        break;
      }
    }
  }
  objs[i] = { x: tmpX, y: tmpY, r: OBJ_R, pTheta: 0, vTheta: 0, vx: 0, vy: 0 };
}

for (i = 0; i < objNum; i++) {
  obj[i].position.set(objs[i].x, objs[i].y, FLAMEDEPTH / 2);
  scene.add(obj[i]);
}

// ゴールの作成
const goalObj1 = [];
const goalObj2 = [];
const goalObj3 = [];
const goalObj1Geometry = new THREE.BoxGeometry(GOAL_THICKNESS, GOAL_HEIGHT, FLAMEDEPTH);
const goalObj3Geometry1 = new THREE.BoxGeometry(BIG_GOAL_WIDTH + GOAL_THICKNESS * 2, GOAL_THICKNESS, FLAMEDEPTH);
const goalObj3Geometry2 = new THREE.BoxGeometry(SMALL_GOAL_WIDTH + GOAL_THICKNESS * 2, GOAL_THICKNESS, FLAMEDEPTH);
const goalObjMaterial = new THREE.MeshPhongMaterial({ color: 0xa0522d });
for (i = 0; i < GOAL_NUM; i++) {
  goalObj1[i] = new THREE.Mesh(goalObj1Geometry, goalObjMaterial);
  goalObj2[i] = new THREE.Mesh(goalObj1Geometry, goalObjMaterial);
}
goalObj3[0] = new THREE.Mesh(goalObj3Geometry1, goalObjMaterial);
goalObj3[1] = new THREE.Mesh(goalObj3Geometry2, goalObjMaterial);
goalObj1[0].position.set(X0 + GOAL_THICKNESS / 2, DOWNEDGE + GOAL_HEIGHT * 3 / 2 + BALL_R * 3 + GOAL_THICKNESS * 2, FLAMEDEPTH / 2);
goalObj1[1].position.set(X0 + GOAL_THICKNESS / 2, DOWNEDGE + GOAL_HEIGHT / 2 + GOAL_THICKNESS + 10, FLAMEDEPTH / 2);
goalObj2[0].position.set(X0 + BIG_GOAL_WIDTH + GOAL_THICKNESS * 3 / 2, DOWNEDGE + GOAL_HEIGHT * 3 / 2 + BALL_R * 3 + GOAL_THICKNESS * 2, FLAMEDEPTH / 2);
goalObj2[1].position.set(X0 + SMALL_GOAL_WIDTH + GOAL_THICKNESS * 3 / 2, DOWNEDGE + GOAL_HEIGHT / 2 + GOAL_THICKNESS + 10, FLAMEDEPTH / 2);
goalObj3[0].position.set(X0 + GOAL_THICKNESS + BIG_GOAL_WIDTH / 2, DOWNEDGE + GOAL_HEIGHT + GOAL_THICKNESS * 5 / 2 + BALL_R * 3, FLAMEDEPTH / 2);
goalObj3[1].position.set(X0 + GOAL_THICKNESS + SMALL_GOAL_WIDTH / 2, DOWNEDGE + GOAL_THICKNESS / 2 + 10, FLAMEDEPTH / 2);
for (i = 0; i < GOAL_NUM; i++) {
  scene.add(goalObj1[i]);
  scene.add(goalObj2[i]);
  scene.add(goalObj3[i]);
}

// 平行光源
const light = new THREE.DirectionalLight('white', 1);   // 白色、強度1（最大）
light.position.set(-40, 30, 30);                        // 光源の位置を設定
scene.add(light);                                       // シーンへ追加

// 設定したカメラ位置からシーンの描画（レンダリング）
renderer.render(scene, camera);

// 初期化（初回読込時 ＆ リセットボタンが押されたとき）
const init = () => {
  // 各種変数の初期化
  anime = false;
  shot = false;
  flag = false;
  move = false;
  game = false;
  points = 0;
  goalTime = 0;
  fallTime = 0;
  time = TIME_0;
  countDown = COUNTDOWN_0;
  xData = [];
  yData = [];
  finishAfterTime = 0;
  goalAfterTime = 0;
  textInfo.innerHTML = "";
  pointInfo.innerHTML = "";
  // テキスト初期化
  info.style.color = "black";
  info.style.fontSize = "25px";
  info.innerHTML = 'Time: ' + time.toFixed(2) + ' s';
  pointInfo.style.fontSize = "25px"
  pointText.innerHTML = "";
  // 質量確認
  if (document.getElementById('5G').checked) {
    ballM = 0.005;
  }
  else if (document.getElementById('10G').checked) {
    ballM = 0.01;
  }
  else if (document.getElementById('15G').checked) {
    ballM = 0.015;
  }

  // ばね
  spring = { y: L - (ballM + SPRING_M) * G / K, v: 0, yPrev: L - (ballM + SPRING_M) * G / K, vPrev: 0 };

  textX.innerHTML = (DOWNEDGE + L - spring.y).toFixed(1) + " [mm]";

  // ボール
  ball = { x: LEFTEDGE + BALL_R, y: DOWNEDGE + spring.y + FLAMEWIDTH + BALL_R, vx: 0, vy: 0, xPrev: LEFTEDGE + BALL_R, yPrev: DOWNEDGE + spring.y + FLAMEWIDTH + BALL_R, vxPrev: 0, vyPrev: 0 };

  ballYBefore = DOWNEDGE + spring.y + FLAMEWIDTH + BALL_R;

  // 前に発射したときのばねの縮み
  y = L - spring.y;

  // 角に衝突した際に使う変数
  edge = { vx: 0, vy: 0, theta: 0, omega: 0, thetaPrev: 0, omegaPrev: 0, flag: 0 };

  // ゴール（ラジオボタンから速さを取得）
  if (document.getElementById('normalSpeed').checked) {
    bigGoalV = BIG_GOAL_V0;
    smallGoalV = SMALL_GOAL_V0;
  }
  else if (document.getElementById('1.5Speed').checked) {
    bigGoalV = BIG_GOAL_V0 * 1.5;
    smallGoalV = SMALL_GOAL_V0 * 1.5
  }
  else if (document.getElementById('doubleSpeed').checked) {
    bigGoalV = BIG_GOAL_V0 * 2;
    smallGoalV = SMALL_GOAL_V0 * 2
  }
  // 大きいゴール
  goals[0] = { x: X0, y: DOWNEDGE + GOAL_HEIGHT + BALL_R * 3 + GOAL_THICKNESS * 2, width: BIG_GOAL_WIDTH, height: GOAL_HEIGHT, v: bigGoalV, flag: 0 };
  // 小さいゴール
  goals[1] = { x: X0, y: DOWNEDGE + FLAMEWIDTH, width: SMALL_GOAL_WIDTH, height: GOAL_HEIGHT, v: smallGoalV, flag: 0 };
  for (i = 0; i < GOAL_NUM; i++) {
    goalObj1[i].position.x = goals[i].x + GOAL_THICKNESS / 2;
    goalObj2[i].position.x = goals[i].x + goals[i].width + GOAL_THICKNESS * 3 / 2;
    goalObj3[i].position.x = goals[i].x + goals[i].width / 2 + GOAL_THICKNESS;
  }

  // 障害物のパラメータ
  if (objNumBefore > 0) {
    for (let i = 0; i < objNumBefore; i++) {
      scene.remove(obj[i]);
    }
    objMaterial.dispose();
    objGeometry.dispose();
  }
  if (document.getElementById('oneObj').checked) {
    objNum = 1;
  }
  else if (document.getElementById('twoObj').checked) {
    objNum = 2;
  }
  else if (document.getElementById('threeObj').checked) {
    objNum = 3;
  }
  if (objNumBefore > 0) {
    obj = [];
    const objGeometry = new THREE.CylinderGeometry(OBJ_R, OBJ_R, FLAMEDEPTH, 20, 1, false, 0, Math.PI * 2);
    const objMaterial = new THREE.MeshPhongMaterial({ color: "RosyBrown" });
    for (let i = 0; i < objNum; i++) {
      obj[i] = new THREE.Mesh(objGeometry, objMaterial);
      obj[i].rotation.set(Math.PI / 2, 0, 0);
    }

    for (let i = 0; i < objNum; i++) {
      let count = 0;
      let tmpX = Math.floor(Math.random() * (RIGHTEDGE - BALL_R * 4 - OBJ_R * 2 - X0 - GAP * 2 + 1)) + X0 + BALL_R * 2 + OBJ_R + GAP;
      let tmpY = Math.floor(Math.random() * (UPEDGE - (DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4 + EDGE_R) + 1)) + DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4;
      for (let j = 0; j < i; j++) {
        if (Math.hypot(objs[j].x - tmpX, objs[j].y - tmpY) < (objs[j].r + OBJ_R + BALL_R * 2 + GAP)) {
          tmpX = Math.floor(Math.random() * (RIGHTEDGE - BALL_R * 4 - OBJ_R * 2 - X0 - GAP * 2 + 1)) + X0 + BALL_R * 2 + OBJ_R + GAP;
          tmpY = Math.floor(Math.random() * (UPEDGE - (DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4 + EDGE_R) + 1)) + DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4;
          j = -1;
          count++;
          if (count > 50) {
            i = -1;
            break;
          }
        }
      }
      objs[i] = { x: tmpX, y: tmpY, r: OBJ_R, pTheta: 0, vTheta: 0, vx: 0, vy: 0 };
    }
    for (i = 0; i < objNum; i++) {
      obj[i].position.set(objs[i].x, objs[i].y, FLAMEDEPTH / 2);
      scene.add(obj[i]);
    }
  }
  // 前回の障害物の数更新
  objNumBefore = objNum;
  // ボールの位置初期化
  sphere.position.set(ball.x, ball.y, BALL_R);
  for (let i = 0; i < 10; i++) {
    springObj[i].position.set(LEFTEDGE + BALL_R, DOWNEDGE + ((L - (ballM + SPRING_M) * G / K) * i / 10 + 5) * spring.y / (L - (ballM + SPRING_M) * G / K), BALL_R);
  }
  // ばね初期化
  springObj2.scale.y = spring.y / (L - (ballM + SPRING_M) * G / K);
  springPlank.position.set(LEFTEDGE + BALL_R, DOWNEDGE + spring.y + PLANK / 2, BALL_R);
  // ボールの前回位置の初期化
  sphereBefore.position.y = ballYBefore;
  // ゴールの色初期化
  for (i = 0; i < GOAL_NUM; i++) {
    goalObj1[0].material.color.setHex(0xa0522d);
  }

  // カメラ位置の初期化
  camera.position.set(0, -400, 1200);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  draw(); // 描画実行
}

// キャンバスの描画
const draw = () => {
  // 設定したカメラ位置からシーンの描画（レンダリング）
  renderer.render(scene, camera);
  // ボールの位置更新
  sphere.position.set(ball.x, ball.y, BALL_R);
  for (let i = 0; i < 10; i++) {
    springObj[i].position.set(LEFTEDGE + BALL_R, DOWNEDGE + ((L - (ballM + SPRING_M) * G / K) * i / 10 + 5) * spring.y / (L - (ballM + SPRING_M) * G / K), BALL_R);
  }
  // ボールの前回発射位置更新
  sphereBefore.position.y = ballYBefore;
  springObj2.scale.y = spring.y / (L - (ballM + SPRING_M) * G / K);
  springObj2.position.y = DOWNEDGE + spring.y / 2;

  // ばねの長さ更新
  springPlank.position.set(LEFTEDGE + BALL_R, DOWNEDGE + spring.y + PLANK / 2, BALL_R);

  // 表に速さを書き込む
  textV.innerHTML = Math.hypot(ball.vx, ball.vy).toFixed(1) + " [mm/s]";
  // ゴールに入ったときゴールの色変更（上手く変わらないときがある）
  for (i = 0; i < GOAL_NUM; i++) {
    if (goals[i].flag == 1) {
      goalObj1[0].material.color.setHex(0xffa500);
    } else {
      goalObj1[0].material.color.setHex(0xa0522d);
    }
  }


  // 描画の更新
  if (anime) {
    // ゴール座標の更新
    for (let i = 0; i < GOAL_NUM; i++) {
      goals[i].x = runge_kutta(goals[i].v, goals[i].x, STEP);
      goalObj1[i].position.x = goals[i].x + GOAL_THICKNESS / 2;
      goalObj2[i].position.x = goals[i].x + goals[i].width + GOAL_THICKNESS * 3 / 2;
      goalObj3[i].position.x = goals[i].x + goals[i].width / 2 + GOAL_THICKNESS;
    }
    // ゴールの速度更新
    for (i = 0; i < GOAL_NUM; i++) {
      if (goals[i].x <= X0 || goals[i].x + goals[i].width + GOAL_THICKNESS * 2 >= RIGHTEDGE) {
        goals[i].v = -goals[i].v;
      }
    }


    // バネの位置の更新
    spring.y = runge_kutta(spring.vPrev, spring.yPrev, STEP);

    // ボール位置の更新
    ball.x = runge_kutta(ball.vxPrev, ball.xPrev, STEP);
    ball.y = runge_kutta(ball.vyPrev, ball.yPrev, STEP);

    // 円運動中
    if (edge.flag == 1) {
      edge.theta = runge_kutta(edge.omegaPrev, edge.thetaPrev, STEP);
      ball.x = LEFTEDGE + EDGE_R - (EDGE_R - BALL_R) * Math.cos(edge.thetaPrev);
      ball.y = UPEDGE - EDGE_R + (EDGE_R - BALL_R) * Math.sin(edge.thetaPrev);
      edge.thetaPrev = edge.theta;
    }

    spring.yPrev = spring.y;
    ball.xPrev = ball.x;
    ball.yPrev = ball.y;

    // 速度の更新
    spring.v = runge_kutta(-K / SPRING_M * (spring.yPrev - L) + G, spring.vPrev, STEP);
    ball.vy = runge_kutta(G, ball.vyPrev, STEP);

    // ボールがバネから離れる瞬間
    if (!shot) {
      spring.v = runge_kutta(-K / (ballM + SPRING_M) * (spring.yPrev - L) + G, spring.vPrev, STEP);
      ball.vy = runge_kutta(-K / (ballM + SPRING_M) * (spring.yPrev - L) + G, spring.vPrev, STEP);
      shot = true;
    }

    // 初めて角に入ったとき
    if (edge.flag == 0 && ball.y >= UPEDGE - EDGE_R) {
      edge.omegaPrev = ball.vyPrev / (EDGE_R - BALL_R);
      edge.omega = runge_kutta(G / (EDGE_R - BALL_R) * Math.cos(edge.thetaPrev), edge.omegaPrev, STEP);
      edge.omegaPrev = edge.omega;
      edge.flag = 1;
    }
    // 円運動から外れたとき
    else if (edge.flag == 1 && (edge.theta >= 1 / 2 * Math.PI || edge.omega <= Math.sqrt(-G / (EDGE_R - BALL_R) * Math.sin(edge.theta)))) {
      ball.vx = (EDGE_R - BALL_R) * edge.omegaPrev * Math.sin(edge.thetaPrev);
      ball.vy = (EDGE_R - BALL_R) * edge.omegaPrev * Math.cos(edge.thetaPrev);
      edge.flag = 2;
    }
    // 円運動中の処理
    else if (edge.flag == 1) {
      edge.omega = runge_kutta(G / (EDGE_R - BALL_R) * Math.cos(edge.thetaPrev), edge.omegaPrev, STEP);
      edge.omegaPrev = edge.omega;
    }

    // ボールが壁に衝突したとき
    if (ball.x >= RIGHTEDGE - BALL_R && ball.vxPrev > 0) {
      ball.vx = -E * ball.vxPrev;
    }
    // ボールがしきりに衝突したとき
    else if (ball.x - BALL_R <= X0 && ball.vxPrev < 0) {
      ball.vx = -E * ball.vxPrev;
    }
    if (ball.x + BALL_R >= X0 - PARTITION && ball.y <= UPEDGE - EDGE_R + EDGE_R * Math.sin(Math.acos(80 / 120)) - BALL_R * 3 && ball.x + BALL_R <= X0 && ball.vxPrev > 0) {
      ball.vx = -E * ball.vxPrev;
    }
    // ボールが天井に衝突したとき
    if (ball.y >= UPEDGE - BALL_R && ball.vyPrev > 0) {
      ball.vy = -E * ball.vyPrev;
    }

    // ボールが右の角に衝突したとき
    if (ball.x >= RIGHTEDGE - EDGE_R && ball.y >= UPEDGE - EDGE_R && Math.hypot(ball.x - RIGHTEDGE + EDGE_R, ball.y - UPEDGE + EDGE_R) >= EDGE_R - BALL_R && (collisionCheck(ball.x, RIGHTEDGE, ball.vxPrev) == true || collisionCheck(ball.y, UPEDGE, ball.vyPrev) == true)) {
      // 角の弧の中心からの角度θ
      edge.theta = Math.atan2(ball.y - UPEDGE + EDGE_R, ball.x - RIGHTEDGE + EDGE_R);
      // 作用線水平方向の速度
      edge.vx = E * (ball.vxPrev * Math.cos(edge.theta) + ball.vyPrev * Math.sin(edge.theta));
      // 作用線垂直方向の速度
      edge.vy = ball.vxPrev * Math.sin(edge.theta) - ball.vyPrev * Math.cos(edge.theta);
      // ボールの速度更新
      ball.vx = edge.vy * Math.sin(edge.theta) - edge.vx * Math.cos(edge.theta);
      ball.vy = -edge.vx * Math.sin(edge.theta) - edge.vy * Math.cos(edge.theta);
      ball.vy = runge_kutta(G, ball.vy, STEP);
    }

    // 障害物と衝突したときの処理
    for (i = 0; i < objNum; i++) {
      if (Math.hypot(ball.x - objs[i].x, ball.y - objs[i].y) <= BALL_R + objs[i].r && (collisionCheck(ball.x, objs[i].x, ball.vxPrev) == true || collisionCheck(ball.y, objs[i].y, ball.vyPrev) == true)) {
        objs[i].pTheta = Math.atan2(objs[i].y - ball.y, objs[i].x - ball.x);
        objs[i].vTheta = Math.atan2(ball.vyPrev, ball.vxPrev); - objs[i].pTheta;
        objs[i].vx = -E * (ball.vxPrev * Math.cos(objs[i].vTheta) + ball.vyPrev * Math.sin(objs[i].vTheta));
        objs[i].vy = ball.vyPrev * Math.cos(objs[i].vTheta) - ball.vxPrev * Math.sin(objs[i].vTheta);
        ball.vx = objs[i].vx * Math.cos(objs[i].pTheta) - objs[i].vy * Math.sin(objs[i].pTheta);
        ball.vy = objs[i].vx * Math.sin(objs[i].pTheta) + objs[i].vy * Math.cos(objs[i].pTheta);
      }
    }

    // ゴールとの衝突
    for (i = 0; i < GOAL_NUM; i++) {
      // ゴール内の左壁
      if (ball.x >= goals[i].x && ball.x - BALL_R <= goals[i].x + GOAL_THICKNESS && ball.y > goals[i].y + GOAL_THICKNESS && ball.y <= goals[i].y + GOAL_THICKNESS + goals[i].height) {
        if (collisionCheck(ball.x, goals[i].x + GOAL_THICKNESS, ball.vxPrev - goals[i].v) == true) {
          ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
        }
        if (ball.vxPrev > 0 && goals[i].v > 0 && Math.abs(ball.vxPrev) < Math.abs(goals[i].v)) {
          ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
        }
      }
      // ゴール内の左角と衝突
      if (Math.hypot(ball.x - goals[i].x - GOAL_THICKNESS, ball.y - goals[i].y - goals[i].height - GOAL_THICKNESS) <= BALL_R && ball.vxPrev < 0 && collisionCheck(ball.x, goals[i].x + GOAL_THICKNESS, ball.vx - goals[i].v) == true) {
        ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
      }
      // ゴール内の右壁
      if (ball.x + BALL_R >= goals[i].x + goals[i].width + GOAL_THICKNESS && ball.x <= goals[i].x + goals[i].width + GOAL_THICKNESS * 2 && ball.y > goals[i].y + GOAL_THICKNESS && ball.y <= goals[i].y + GOAL_THICKNESS + goals[i].height) {
        if (collisionCheck(ball.x, goals[i].x + goals[i].width + GOAL_THICKNESS, ball.vxPrev - goals[i].v) == true) {
          ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
        }
        if (ball.vxPrev < 0 && goals[i].v < 0 && Math.abs(ball.vxPrev) < Math.abs(goals[i].v)) {
          ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
        }
      }
      // ゴール内の右角と衝突
      if (Math.hypot(ball.x - goals[i].x - goals[i].width - GOAL_THICKNESS, ball.y - goals[i].y - goals[i].height - GOAL_THICKNESS) <= BALL_R && ball.vxPrev > 0 && collisionCheck(ball.x, goals[i].x + goals[i].width + GOAL_THICKNESS, ball.vx - goals[i].v) == true) {
        ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
      }
      // ゴール外の左壁
      if (ball.x + BALL_R >= goals[i].x && ball.x <= goals[i].x && ball.y > goals[i].y + GOAL_THICKNESS && ball.y <= goals[i].y + GOAL_THICKNESS + goals[i].height) {
        if (collisionCheck(ball.x, goals[i].x + GOAL_THICKNESS, ball.vxPrev - goals[i].v) == true) {
          ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
        } else if (ball.vxPrev < 0 && goals[i].v < 0 && Math.abs(ball.vxPrev) < Math.abs(goals[i].v)) {
          ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
        }
      }

      // ゴール外の左角と衝突
      if ((Math.hypot(ball.x - goals[i].x, ball.y - goals[i].y) <= BALL_R || Math.hypot(ball.x - goals[i].x, ball.y - goals[i].y - goals[i].height - GOAL_THICKNESS) <= BALL_R) && ball.vxPrev > 0 && collisionCheck(ball.x, goals[i].x + GOAL_THICKNESS, ball.vx - goals[i].v) == true) {
        ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
      }
      // ゴール外の右壁
      if (ball.x >= goals[i].x + goals[i].width + GOAL_THICKNESS * 2 && ball.x - BALL_R <= goals[i].x + goals[i].width + GOAL_THICKNESS * 2 && ball.y > goals[i].y + GOAL_THICKNESS && ball.y <= goals[i].y + GOAL_THICKNESS + goals[i].height) {
        if (collisionCheck(ball.x, goals[i].x + goals[i].width + GOAL_THICKNESS * 2, ball.vxPrev - goals[i].v) == true) {
          ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
        } else if (ball.vxPrev > 0 && goals[i].v > 0 && Math.abs(ball.vxPrev) < Math.abs(goals[i].v)) {
          ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
        }
      }
      // ゴール外の右角と衝突
      if ((Math.hypot(ball.x - goals[i].x - goals[i].width - GOAL_THICKNESS * 2, ball.y - goals[i].y) <= BALL_R || Math.hypot(ball.x - goals[i].x - goals[i].width - GOAL_THICKNESS * 2, ball.y - goals[i].y - goals[i].height - GOAL_THICKNESS) <= BALL_R) && ball.vxPrev < 0 && collisionCheck(ball.x, goals[i].x + goals[i].width + GOAL_THICKNESS * 2, ball.vx - goals[i].v) == true) {
        ball.vx = (1 + E) * goals[i].v - E * ball.vxPrev;
      }

      // ボールが上からゴールの上の角と衝突
      if ((Math.hypot(ball.x - goals[i].x - 5, ball.y - goals[i].y - goals[i].height - GOAL_THICKNESS) <= BALL_R || Math.hypot(ball.x - goals[i].x - goals[i].width - GOAL_THICKNESS * 1.5, ball.y - goals[i].y - goals[i].height - GOAL_THICKNESS) <= BALL_R) && ball.vyPrev < 0 && collisionCheck(ball.y, goals[i].y + goals[i].height + GOAL_THICKNESS, ball.vy) == true) {
        ball.vy = -E * ball.vyPrev;
      }
      // ボールがゴールの床に上から衝突
      if (ball.x >= goals[i].x + GOAL_THICKNESS && ball.x <= goals[i].x + goals[i].width + GOAL_THICKNESS && ball.y >= goals[i].y && ball.y - BALL_R <= goals[i].y + GOAL_THICKNESS && ball.vyPrev < 0 && collisionCheck(ball.y, goals[i].y, ball.vyPrev) == true) {
        ball.vy = -E / 2 * ball.vyPrev;
      }
      // ボールがゴールに下から衝突
      if (ball.x >= goals[i].x && ball.x <= goals[i].x + goals[i].width + GOAL_THICKNESS * 2 && ball.y + BALL_R >= goals[i].y + 0 && ball.y + BALL_R <= goals[i].y + GOAL_THICKNESS && ball.vyPrev > 0 && collisionCheck(ball.y, goals[i].y, ball.vyPrev) == true) {
        ball.vy = -E * ball.vyPrev;
      }
      // ボールがゴールに下から衝突(角)
      if ((Math.hypot(ball.x - goals[i].x, ball.y - goals[i].y) <= BALL_R || Math.hypot(ball.x - goals[i].x - goals[i].width - GOAL_THICKNESS * 2, ball.y - goals[i].y) <= BALL_R) && ball.vyPrev > 0 && collisionCheck(ball.y, goals[i].y, ball.vy) == true) {
        ball.vy = -E * ball.vyPrev;
      }
      // ボールが壁とゴールに挟まれたときゴールが折り返す
      if (ball.x + BALL_R >= goals[i].x && ball.x <= goals[i].x && ball.y >= goals[i].y && ball.y <= goals[i].y + GOAL_THICKNESS + GOAL_HEIGHT && goals[i].x < X0 + BALL_R * 2) {
        goals[i].v = -goals[i].v;
      }
      if (ball.x >= goals[i].x + goals[i].width + GOAL_THICKNESS * 2 && ball.x - BALL_R <= goals[i].x + goals[i].width + GOAL_THICKNESS * 2 && ball.y >= goals[i].y && ball.y <= goals[i].y + GOAL_THICKNESS + GOAL_HEIGHT && goals[i].x >= RIGHTEDGE - BALL_R * 2) {
        goals[i].v = -goals[i].v;
      }
    }
    // ボールがゴールに入ったとき
    for (i = 0; i < GOAL_NUM; i++) {
      if (ball.x >= goals[i].x + GOAL_THICKNESS && ball.x <= goals[i].x + goals[i].width - GOAL_THICKNESS && ball.y >= goals[i].y + GOAL_THICKNESS && ball.y <= goals[i].y + goals[i].height + GOAL_THICKNESS) {
        goals[i].flag = 1;
        goalTime += STEP;
        if (goalTime >= 1.5) {
          // goals[i].flag = 0;
          if (i == 0) {
            points += BIG_GOAL_POINTS;
          } else if (i == 1) {
            points += SMALL_GOAL_POINTS;
          }
          nextBall();
        }
      } else {
        goals[i].flag = 0;
      }
    } // ゴールフラグを数える
    for (i = 0; i < GOAL_NUM; i++) {
      goalFlagSum += goals[i].flag;
    } // ゴールフラグなしのとき
    if (goalFlagSum == 0) {
      goalTime = 0;
    }
    // ボールが落ちたとき
    if (ball.y + BALL_R <= DOWNEDGE) {
      fallTime += STEP;
      if (fallTime >= 1.5) {
        nextBall();
      }
    }

    // ドラッグ時速度 0
    if (drag) {
      ball.vx = ball.vy = 0;
    }

    // 前の速度の更新
    spring.vPrev = spring.v;
    ball.vxPrev = ball.vx;
    ball.vyPrev = ball.vy;
    requestAnimationFrame(draw);
  }

}

// アニメーション開始ボタンが押されたとき
const startAnime = () => {
  if (anime) {
    drag = false;
    anime = false;
  } else {
    drag = false;
    anime = true;
    draw();
  }
}

// ゲームを開始したときに初期化する関数
const startGame = () => {
  // 各種変数の初期化
  anime = false;
  shot = false;
  flag = false;
  move = true;
  game = true;
  drag = false;
  points = 0;
  goalTime = 0;
  fallTime = 0;
  time = TIME_0;
  countDown = COUNTDOWN_0;
  xData = [];
  yData = [];
  finishAfterTime = 0;

  // canvas 内のテキスト消去
  textInfo.innerHTML = "";
  pointText.innerHTML = "";

  // ばね
  spring = { y: L - (ballM + SPRING_M) * G / K, v: 0, yPrev: L - (ballM + SPRING_M) * G / K, vPrev: 0 };

  // ボール
  ball = { x: LEFTEDGE + BALL_R, y: DOWNEDGE + spring.y + FLAMEWIDTH + BALL_R, vx: 0, vy: 0, xPrev: LEFTEDGE + BALL_R, yPrev: DOWNEDGE + spring.y + FLAMEWIDTH + BALL_R, vxPrev: 0, vyPrev: 0 };
  if (document.getElementById('5G').checked) {
    ballM = 0.005;
  }
  else if (document.getElementById('10G').checked) {
    ballM = 0.01;
  }
  else if (document.getElementById('15G').checked) {
    ballM = 0.015;
  }

  // 前に発射したときのばねの縮み
  y = L - spring.y;

  // 角に衝突した際に使う変数
  edge = { vx: 0, vy: 0, theta: 0, omega: 0, thetaPrev: 0, omegaPrev: 0, flag: 0 };

  // ゴール
  // 大きいゴール
  goals[0] = { x: X0, y: DOWNEDGE + GOAL_HEIGHT + BALL_R * 3 + GOAL_THICKNESS * 2, width: BIG_GOAL_WIDTH, height: GOAL_HEIGHT, v: bigGoalV, flag: 0 };
  // 小さいゴール
  goals[1] = { x: X0, y: DOWNEDGE + FLAMEWIDTH, width: SMALL_GOAL_WIDTH, height: GOAL_HEIGHT, v: smallGoalV, flag: 0 };
  for (i = 0; i < GOAL_NUM; i++) {
    goalObj1[i].position.x = goals[i].x + GOAL_THICKNESS / 2;
    goalObj2[i].position.x = goals[i].x + goals[i].width + GOAL_THICKNESS * 3 / 2;
    goalObj3[i].position.x = goals[i].x + goals[i].width / 2 + GOAL_THICKNESS;
  }

  // 障害物のパラメータ
  if (objNumBefore > 0) {
    for (let i = 0; i < objNumBefore; i++) {
      scene.remove(obj[i]);
    }
    objMaterial.dispose();
    objGeometry.dispose();
  }
  if (document.getElementById('oneObj').checked) {
    objNum = 1;
  }
  else if (document.getElementById('twoObj').checked) {
    objNum = 2;
  }
  else if (document.getElementById('threeObj').checked) {
    objNum = 3;
  }
  if (objNumBefore > 0) {
    obj = [];
    const objGeometry = new THREE.CylinderGeometry(OBJ_R, OBJ_R, FLAMEDEPTH, 20, 1, false, 0, Math.PI * 2);
    const objMaterial = new THREE.MeshPhongMaterial({ color: 'RosyBrown' });
    for (let i = 0; i < objNum; i++) {
      obj[i] = new THREE.Mesh(objGeometry, objMaterial);
      obj[i].rotation.set(Math.PI / 2, 0, 0);
    }

    for (let i = 0; i < objNum; i++) {
      let count = 0;
      let tmpX = Math.floor(Math.random() * (RIGHTEDGE - BALL_R * 4 - OBJ_R * 2 - X0 - GAP * 2 + 1)) + X0 + BALL_R * 2 + OBJ_R + GAP;
      let tmpY = Math.floor(Math.random() * (UPEDGE - (DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4 + EDGE_R) + 1)) + DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4;
      for (let j = 0; j < i; j++) {
        if (Math.hypot(objs[j].x - tmpX, objs[j].y - tmpY) < (objs[j].r + OBJ_R + BALL_R * 2 + GAP)) {
          tmpX = Math.floor(Math.random() * (RIGHTEDGE - BALL_R * 4 - OBJ_R * 2 - X0 - GAP * 2 + 1)) + X0 + BALL_R * 2 + OBJ_R + GAP;
          tmpY = Math.floor(Math.random() * (UPEDGE - (DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4 + EDGE_R) + 1)) + DOWNEDGE + GOAL_HEIGHT * 2 + GAP * 3 + GOAL_THICKNESS * 2 + BALL_R * 4;
          j = -1;
          count++;
          if (count > 50) {
            i = -1;
            break;
          }
        }
      }
      objs[i] = { x: tmpX, y: tmpY, r: OBJ_R, pTheta: 0, vTheta: 0, vx: 0, vy: 0 };
    }
    for (i = 0; i < objNum; i++) {
      obj[i].position.set(objs[i].x, objs[i].y, FLAMEDEPTH / 2);
      scene.add(obj[i]);
    }
  }

  objNumBefore = objNum;

  // ボールを戻す
  sphere.position.set(ball.x, ball.y, BALL_R);
  // 前回発射位置を戻す
  ballYBefore = ball.y;
  sphereBefore.position.y = ballYBefore;
  // ばねオブジェクトを戻す
  for (let i = 0; i < 10; i++) {
    springObj[i].position.set(LEFTEDGE + BALL_R, DOWNEDGE + ((L - (ballM + SPRING_M) * G / K) * i / 10 + 5) * spring.y / (L - (ballM + SPRING_M) * G / K), BALL_R);
  }
  springObj2.scale.y = spring.y / (L - (ballM + SPRING_M) * G / K);
  // ばね下の板のオブジェクトを戻す
  springPlank.position.set(LEFTEDGE + BALL_R, DOWNEDGE + spring.y + PLANK / 2, BALL_R);
  // ゴールの色を戻す
  for (i = 0; i < GOAL_NUM; i++) {
    goalObj1[0].material.color.setHex(0xa0522d);
  }

  // カメラ位置の初期化
  camera.position.set(0, -400, 1200);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  draw();
}
// 新しいボールが出たときの関数
const nextBall = () => {
  anime = false;
  shot = false;
  flag = false;
  goalTime = 0;
  fallTime = 0;

  // ばね
  spring = { y: L - (ballM + SPRING_M) * G / K, v: 0, yPrev: L - (ballM + SPRING_M) * G / K, vPrev: 0 };
  // ボール
  ball = { x: LEFTEDGE + BALL_R, y: DOWNEDGE + spring.y + FLAMEWIDTH + BALL_R, vx: 0, vy: 0, xPrev: LEFTEDGE + BALL_R, yPrev: spring.y + FLAMEWIDTH + BALL_R, vxPrev: 0, vyPrev: 0 };

  // 角に衝突した際に使う変数
  edge = { vx: 0, vy: 0, theta: 0, omega: 0, thetaPrev: 0, omegaPrev: 0, flag: 0 };

  sphere.position.set(ball.x, ball.y, BALL_R);
  for (let i = 0; i < 10; i++) {
    springObj[i].position.set(LEFTEDGE + BALL_R, DOWNEDGE + ((L - (ballM + SPRING_M) * G / K) * i / 10 + 5) * spring.y / (L - (ballM + SPRING_M) * G / K), BALL_R);
  }
  springObj2.scale.y = spring.y / (L - (ballM + SPRING_M) * G / K);

  springPlank.position.set(LEFTEDGE + BALL_R, DOWNEDGE + spring.y + PLANK / 2, BALL_R);

  for (i = 0; i < GOAL_NUM; i++) {
    goalObj1[0].material.color.setHex(0xa0522d);
  }

  // カメラ位置の初期化
  camera.position.set(0, -400, 1200);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  draw();
}

// マウスが動いたとき
canvas.addEventListener('mousemove', (e) => {
  if (!anime) draw();
  // ボールのスクリーン位置を取得
  const worldPosition = sphere.getWorldPosition(new THREE.Vector3());
  const projection = worldPosition.project(camera);
  const sx = (canvas.width / 2) * (+projection.x + 1);
  const sy = canvas.height - (canvas.height / 2) * (-projection.y + 1);
  // マウスの位置取得
  const mouseX = e.offsetX - MOUSEX_GAP;
  const mouseY = canvas.height - e.offsetY;

  if (!anime) {
    if ((game && countDown <= 0 && time > 0) || !game) {
      if (drag) {
        controls.enablePan = false;
        controls.enableRotate = false;
        // 座標更新
        ball.y = ball.yPrev + mouseY - mouseDownY;
        spring.y = spring.yPrev + mouseY - mouseDownY;
        if (spring.y >= SPRING_MIN && spring.y <= L - (ballM + SPRING_M) * G / K) {
        } else {
          if (spring.y < SPRING_MIN) {
            ball.y = DOWNEDGE + BALL_R + SPRING_MIN + PLANK;
            spring.y = SPRING_MIN;
          } else if (spring.y > L - (ballM + SPRING_M) * G / K) {
            ball.y = DOWNEDGE + L - (ballM + SPRING_M) * G / K + BALL_R;
            spring.y = L - (ballM + SPRING_M) * G / K;
          }
        }
        draw();
      } else {
        if (Math.hypot(sx - mouseX, sy - mouseY) <= BALL_R) {
          over = true;
          canvas.style.cursor = 'pointer';

        } else {
          over = false;
          canvas.style.cursor = 'default';

        }
      }
    }
  }
});


// マウスが押下されたとき
canvas.addEventListener('mousedown', (e) => {
  if (!anime && over) {
    if ((game && countDown <= 0 && time > 0) || !game) {
      controls.enablePan = false;
      controls.enableRotate = false;
      drag = true;
      let rect = e.target.getBoundingClientRect();
      mouseDownY = canvas.height - Math.round(e.clientY - rect.top) - FLAMEWIDTH;
      ball.yPrev = ball.y;
      spring.yPrev = spring.y;
      draw();
    }
  }
});


// マウスが離されたとき
canvas.addEventListener('mouseup', (e) => {
  if (!anime && drag) {
    controls.enablePan = true;
    controls.enableRotate = true;
    if ((game && countDown <= 0 && time > 0) || !game) {
      drag = false;
      ball.yPrev = ball.y;
      spring.yPrev = spring.y;
      spring.v = spring.vPrev + STEP * (-K / (SPRING_M + ballM) * (spring.yPrev - L) + G);
      ball.vy = ball.vyPrev + STEP * (-K / (SPRING_M + ballM) * (spring.yPrev - L) + G);
      y = L - spring.y;
      ballYBefore = ball.y
      spring.vPrev = spring.v;
      ball.vyPrev = ball.vy;
      shot = false;
      move = true;
      xData = [];
      yData = [];
      xData = [ball.x];
      yData = [ball.y];
      startAnime();
    }
  }
});

// タッチ操作（ドラッグ中）
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  controls.enablePan = true;
  controls.enableRotate = true;
  if (!anime) draw();
  if (drag) {
    // ボールのスクリーン位置を取得
    const worldPosition = sphere.getWorldPosition(new THREE.Vector3());
    const projection = worldPosition.project(camera);
    const sx = (canvas.width / 2) * (+projection.x + 1);
    const sy = canvas.height - (canvas.height / 2) * (-projection.y + 1);

    if ((game && countDown <= 0 && time > 0) || !game) {
      const touches = e.changedTouches;
      const offset = e.target.getBoundingClientRect();
      const mouseX = touches[0].pageX - offset.left - FLAMEWIDTH - TOUCHX_GAP;
      const mouseY = canvas.height - touches[0].pageY + offset.top - FLAMEWIDTH - TOUCHY_GAP;
      if (!anime) {
        if (drag && Math.hypot(sx - mouseX, sy - mouseY) <= BALL_R * 4) {
          over = true;
          controls.enablePan = false;
          controls.enableRotate = false;
          ball.y = ball.yPrev + mouseY - mouseDownY;
          spring.y = spring.yPrev + mouseY - mouseDownY;
          if (spring.y >= SPRING_MIN && spring.y <= L - (ballM + SPRING_M) * G / K) {
          } else {
            if (spring.y < SPRING_MIN) {
              ball.y = DOWNEDGE + BALL_R + SPRING_MIN + PLANK;
              spring.y = SPRING_MIN;
            } else if (spring.y > L - (ballM + SPRING_M) * G / K) {
              ball.y = DOWNEDGE + L - (ballM + SPRING_M) * G / K + BALL_R;
              spring.y = L - (ballM + SPRING_M) * G / K;
            }
          }
          draw();
        } else {
          over = false;
        }
      }
    }
  }
});
// タッチ操作（タッチし始めたとき）
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!anime) {
    if ((game && countDown <= 0 && time > 0) || !game) {
      controls.enablePan = false;
      controls.enableRotate = false;
      drag = true;
      const touches = e.touches;
      const offset = e.target.getBoundingClientRect();
      mouseDownY = canvas.height - touches[0].pageY + offset.top - FLAMEWIDTH - TOUCHY_GAP;
      ball.yPrev = ball.y;
      spring.yPrev = spring.y;
      draw();
    }
  }
});
// タッチ操作（タッチし終わったとき）
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!anime && drag) {
    controls.enablePan = true;
    controls.enableRotate = true;
    if ((game && countDown <= 0 && time > 0) || !game && over) {
      drag = false;
      ball.yPrev = ball.y;
      spring.yPrev = spring.y;
      spring.v = spring.vPrev + STEP * (-K / (SPRING_M + ballM) * (spring.yPrev - L) + G);
      ball.vy = ball.vyPrev + STEP * (-K / (SPRING_M + ballM) * (spring.yPrev - L) + G);
      y = L - spring.y;
      spring.vPrev = spring.v;
      ball.vyPrev = ball.vy;
      shot = false;
      move = true;
      xData = [];
      yData = [];
      xData = [ball.x];
      yData = [ball.y];
      startAnime();
    }
  }
});
// マウスドラッグ・ホイール操作中は描画を更新
canvas.addEventListener('wheel', (e) => { if (!anime) draw(); });

// 経過時間の表示
setInterval(
  function () {
    if (game == true && countDown > 0) {
      countDown -= STEP;
      textInfo.style.left = rect.left + canvas.width / 2 - 10 + 'px';
      textInfo.innerHTML = Math.floor(countDown + 1);
    }
    if (game == true && countDown <= 0) {
      countDown = 0;
      time -= STEP;
    }
    if (countDown == 0 && time > TIME_0 - 1 && game) {
      info.style.color = "red";
      textInfo.style.left = rect.left + canvas.width / 2 - 80 + 'px';
      textInfo.innerHTML = "START!";
    }
    if (game && time <= 0) {
      time = 0;
    }
    if (countDown <= 0) {
      info.style.color = "black";
      if (time < 5) {
        info.style.color = "red";
        textInfo.style.left = rect.left + canvas.width / 2 - 10 + 'px';
        textInfo.innerHTML = Math.floor(time + 1);
      }
      if (time < TIME_0 - 1 && time > 5) {
        textInfo.innerHTML = "";
      }
    }

    for (let i = 0; i < GOAL_NUM; i++) {
      if (goals[i].flag == 1 && goalTime == 0) {
        goalAfterTime += STEP;
        if (goalAfterTime >= 5) {
          goals[i].flag = 0;
          goalAfterTime = 0;
        }
      }
    }

    if (time == 0) {
      textInfo.style.left = rect.left + canvas.width / 2 - 80 + 'px';
      textInfo.innerHTML = "FINISH!";
      if (ball.x == LEFTEDGE + BALL_R && ball.y == DOWNEDGE + spring.y + PLANK + BALL_R) {
        finishAfterTime += STEP;
        if (finishAfterTime > 1) {
          pointText.style.left = rect.left + canvas.width / 2 - 140 + 'px';
          if (points == 0) {
            pointText.style.left = rect.left + canvas.width / 2 - 90 + 'px';
          }
          pointText.innerHTML = points + " points"
        }
        if (finishAfterTime > 2) {
          textInfo.style.left = rect.left + canvas.width / 2 - 140 + 'px';
          if (points <= 100) {
            textInfo.innerHTML = "Keep trying!";
          } else if (points >= 200 && points <= 400) {
            textInfo.innerHTML = "Good job!";
          } else if (points >= 500) {
            textInfo.innerHTML = "Amazing!";
          }
        }
      }
    }
    info.innerHTML = "Time: " + time.toFixed(2) + " s";
    pointInfo.style.fontSize = "25px"
    pointInfo.innerHTML = points + ' Points';
    textX.innerHTML = (L - spring.y).toFixed(1) + " [mm]";
    // draw();
  }
  , 1000 * STEP);

// Tooltipの実装
document.addEventListener('DOMContentLoaded', function () {
  const elems = document.querySelectorAll('.tooltipped');
  const instances = M.Tooltip.init(elems);
});

init();