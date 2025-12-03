declare module "../utils/faceDetection" {
  export function loadFaceModels(): Promise<void>;
  export function detectFace(image: HTMLImageElement): Promise<any>;
}
