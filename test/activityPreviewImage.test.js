import test from "node:test";
import assert from "node:assert/strict";
import {
  getActivityPreviewImage,
  getActivityPreviewImageCandidates,
  isDirectActivityImageUrl
} from "../src/utils/activityPreviewImage.js";
import { getActivityDashboardMedia } from "../src/utils/activityDashboardMedia.js";
import { migrateActivities, migrateActivityRecord } from "../scripts/migrateActivitiesSchema.js";

test("getActivityPreviewImageCandidates ignores trace.moe result image URLs", () => {
  const activity = {
    animeTitle: "Kedama no Gonjirou",
    imageUrl: "https://api.trace.moe/image/pOCYNZyNwPfZSc0Oi5qNh6",
    traceMoe: {
      imageUrl: "https://api.trace.moe/image/pOCYNZyNwPfZSc0Oi5qNh6"
    },
    media: {
      resultImageUrl: "https://api.trace.moe/image/pOCYNZyNwPfZSc0Oi5qNh6"
    }
  };

  assert.deepEqual(getActivityPreviewImageCandidates(activity), []);
  assert.equal(getActivityPreviewImage(activity), null);
});

test("getActivityPreviewImageCandidates does not use old botResponse imageUrl records", () => {
  const activity = {
    animeTitle: "InuYasha",
    imageUrl: "https://api.trace.moe/image/kO8OnbMm4YzEeLPoQDVvHnM",
    botResponse: {
      imageUrl: "https://api.trace.moe/image/kO8OnbMm4YzEeLPoQDVvHnM"
    }
  };

  assert.deepEqual(getActivityPreviewImageCandidates(activity), []);
  assert.equal(getActivityPreviewImage(activity), null);
});

test("getActivityDashboardMedia uses the required dashboard image order", () => {
  const activity = {
    imageUrl: "https://cdn.example.test/image-url.jpg",
    inputPreview: "https://cdn.example.test/input-preview.jpg",
    inputThumbnail: "https://cdn.example.test/input-thumbnail.jpg",
    inputImageUrl: "https://cdn.example.test/input-image.jpg",
    inputUrl: "https://cdn.example.test/direct.png",
    inputFileId: "legacy-input-file-id",
    media: {
      dashboardImageUrl: "https://cdn.example.test/dashboard.jpg",
      dashboardImageFileId: "dashboard-file-id",
      selectedTelegramFileId: "selected-file-id",
      resultImageUrl: "https://cdn.example.test/result.jpg",
      botImageUrl: "https://cdn.example.test/bot.jpg"
    },
    botResponse: {
      imageUrl: "https://cdn.example.test/bot-response.jpg"
    },
    input: {
      telegramFileId: "input-file-id",
      preview: "https://cdn.example.test/input-preview-new.jpg",
      thumbnail: "https://cdn.example.test/input-thumbnail-new.jpg",
      selectedImageUrl: "https://cdn.example.test/selected-new.jpg"
    }
  };

  assert.deepEqual(getActivityDashboardMedia(activity).imageUrls, [
    "https://cdn.example.test/dashboard.jpg",
    "https://cdn.example.test/input-preview-new.jpg",
    "https://cdn.example.test/input-thumbnail-new.jpg",
    "https://cdn.example.test/selected-new.jpg",
    "https://cdn.example.test/input-preview.jpg",
    "https://cdn.example.test/input-thumbnail.jpg"
  ]);
  assert.deepEqual(getActivityDashboardMedia(activity).imageFileCandidates.map((candidate) => candidate.fileId), [
    "dashboard-file-id",
    "selected-file-id",
    "input-file-id",
    "legacy-input-file-id"
  ]);
});

test("getActivityPreviewImageCandidates excludes non-image inputUrl fallback", () => {
  assert.equal(isDirectActivityImageUrl("https://example.test/page"), false);
  assert.equal(isDirectActivityImageUrl("https://api.trace.moe/image/temporary"), false);
  assert.equal(isDirectActivityImageUrl("https://example.test/image.webp?size=large"), true);
  assert.deepEqual(getActivityPreviewImageCandidates({
    inputUrl: "https://example.test/page"
  }), []);
});

test("migrateActivityRecord moves old trace.moe media into traceMoe and keeps Telegram media", () => {
  const migrated = migrateActivityRecord("activity-1", {
    userId: 123,
    user: { telegramId: "123" },
    inputUrl: "https://example.test/post",
    inputSourceDomain: "example.test",
    inputTelegramFileId: "telegram-input-file",
    selectedImageUrl: "https://cdn.example.test/selected.jpg",
    animeTitle: "Kedama no Gonjirou",
    similarity: 91.2,
    media: {
      resultImageUrl: "https://api.trace.moe/image/result",
      resultVideoUrl: "https://api.trace.moe/video/result",
      sentVideoFileId: "sent-video-file"
    },
    botResponse: {
      imageUrl: "https://api.trace.moe/image/result",
      videoUrl: "https://api.trace.moe/video/result"
    }
  });

  assert.equal(migrated.input.telegramFileId, "telegram-input-file");
  assert.equal(migrated.input.selectedImageUrl, "https://cdn.example.test/selected.jpg");
  assert.equal(migrated.media.inputTelegramFileId, "telegram-input-file");
  assert.equal(migrated.media.sentVideoFileId, "sent-video-file");
  assert.equal(migrated.media.dashboardImageFileId, "telegram-input-file");
  assert.equal(migrated.traceMoe.imageUrl, "https://api.trace.moe/image/result");
  assert.equal(migrated.traceMoe.videoUrl, "https://api.trace.moe/video/result");
  assert.equal(migrated.botResponse.imageUrl, "https://api.trace.moe/image/result");
});

test("migrateActivities dry-run does not write and apply writes only with --apply semantics", async () => {
  const writes = [];
  const fakeDoc = {
    id: "activity-1",
    data: () => ({ inputFileId: "legacy-file-id" }),
    ref: {
      set: async (...args) => writes.push(args)
    }
  };
  const db = {
    collection(name) {
      assert.equal(name, "activities");
      return {
        async get() {
          return { docs: [fakeDoc] };
        }
      };
    }
  };

  const dryRun = await migrateActivities({ db, apply: false, logger: { log() {} } });
  assert.equal(dryRun.writes, 0);
  assert.equal(writes.length, 0);

  const apply = await migrateActivities({ db, apply: true, logger: { log() {} } });
  assert.equal(apply.writes, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0].media.inputTelegramFileId, "legacy-file-id");
});
