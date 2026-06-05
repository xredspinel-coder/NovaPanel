import test from "node:test";
import assert from "node:assert/strict";
import {
  getActivityPreviewImage,
  getActivityPreviewImageCandidates,
  isDirectActivityImageUrl
} from "../src/utils/activityPreviewImage.js";

test("getActivityPreviewImageCandidates prefers recent media.resultImageUrl", () => {
  const activity = {
    animeTitle: "Kedama no Gonjirou",
    imageUrl: "https://api.trace.moe/image/pOCYNZyNwPfZSc0Oi5qNh6",
    media: {
      resultImageUrl: "https://api.trace.moe/image/pOCYNZyNwPfZSc0Oi5qNh6"
    }
  };

  assert.deepEqual(getActivityPreviewImageCandidates(activity), [
    "https://api.trace.moe/image/pOCYNZyNwPfZSc0Oi5qNh6"
  ]);
  assert.equal(getActivityPreviewImage(activity), "https://api.trace.moe/image/pOCYNZyNwPfZSc0Oi5qNh6");
});

test("getActivityPreviewImageCandidates supports old botResponse imageUrl records", () => {
  const activity = {
    animeTitle: "InuYasha",
    imageUrl: "https://api.trace.moe/image/kO8OnbMm4YzEeLPoQDVvHnM",
    botResponse: {
      imageUrl: "https://api.trace.moe/image/kO8OnbMm4YzEeLPoQDVvHnM"
    }
  };

  assert.deepEqual(getActivityPreviewImageCandidates(activity), [
    "https://api.trace.moe/image/kO8OnbMm4YzEeLPoQDVvHnM"
  ]);
  assert.equal(getActivityPreviewImage(activity), "https://api.trace.moe/image/kO8OnbMm4YzEeLPoQDVvHnM");
});

test("getActivityPreviewImageCandidates uses the required fallback order", () => {
  const activity = {
    imageUrl: "https://cdn.example.test/image-url.jpg",
    inputPreview: "https://cdn.example.test/input-preview.jpg",
    inputThumbnail: "https://cdn.example.test/input-thumbnail.jpg",
    inputImageUrl: "https://cdn.example.test/input-image.jpg",
    inputUrl: "https://cdn.example.test/direct.png",
    media: {
      resultImageUrl: "https://cdn.example.test/result.jpg",
      botImageUrl: "https://cdn.example.test/bot.jpg"
    },
    botResponse: {
      imageUrl: "https://cdn.example.test/bot-response.jpg"
    }
  };

  assert.deepEqual(getActivityPreviewImageCandidates(activity), [
    "https://cdn.example.test/result.jpg",
    "https://cdn.example.test/image-url.jpg",
    "https://cdn.example.test/bot-response.jpg",
    "https://cdn.example.test/bot.jpg",
    "https://cdn.example.test/input-preview.jpg",
    "https://cdn.example.test/input-thumbnail.jpg",
    "https://cdn.example.test/input-image.jpg",
    "https://cdn.example.test/direct.png"
  ]);
});

test("getActivityPreviewImageCandidates excludes non-image inputUrl fallback", () => {
  assert.equal(isDirectActivityImageUrl("https://example.test/page"), false);
  assert.equal(isDirectActivityImageUrl("https://example.test/image.webp?size=large"), true);
  assert.deepEqual(getActivityPreviewImageCandidates({
    inputUrl: "https://example.test/page"
  }), []);
});
