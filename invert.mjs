import { Jimp } from "jimp";

async function invertLogo() {
  try {
    const image = await Jimp.read("public/logo.png");
    image.invert();
    await image.write("public/logo-white.png");
    console.log("Successfully created logo-white.png");
  } catch (err) {
    console.error("Error processing image:", err);
  }
}

invertLogo();
