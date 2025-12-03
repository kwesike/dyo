import * as faceapi from "face-api.js";

// Load only the required models for face detection
export async function loadFaceModels() {
  const MODEL_URL = "/models"; // Must be inside public/models

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  ]);

  console.log("✅ Face detection models loaded");
}

// Detect face with landmarks (more accurate box)
export async function detectFace(image) {
  const result = await faceapi
    .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks();

  if (!result) {
    console.warn("No face detected");
    return null;
  }

  return result.detection.box; // 👈 return the bounding box directly
}
