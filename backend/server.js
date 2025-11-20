const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const cron = require("node-cron");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ===== DATABASE CONNECT =====
mongoose.connect("YOUR_MONGO_STRING_HERE")
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

// ===== MONGODB SCHEMA =====
const StatsSchema = new mongoose.Schema({
  videoId: String,
  timestamp: Date,
  views: Number,
  likes: Number,
  intervalViews: Number,
  intervalLikes: Number
});

const Stats = mongoose.model("Stats", StatsSchema);

// ===== GLOBAL SETTINGS =====
let TRACK_VIDEO_ID = null;
let API_KEY = "YOUR_YOUTUBE_API_KEY";

// ===== FUNCTION: FETCH YOUTUBE DATA =====
async function fetchYouTubeStats(videoId) {
  const url =
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${API_KEY}`;

  const res = await axios.get(url);
  const stats = res.data.items[0].statistics;

  return {
    views: Number(stats.viewCount),
    likes: Number(stats.likeCount)
  };
}

// ===== CRON JOB EVERY 5 MINUTES =====
cron.schedule("*/5 * * * *", async () => {
  if (!TRACK_VIDEO_ID) return;

  const { views, likes } = await fetchYouTubeStats(TRACK_VIDEO_ID);

  const last = await Stats.findOne().sort({ timestamp: -1 });

  let intervalViews = 0;
  let intervalLikes = 0;

  if (last) {
    intervalViews = views - last.views;
    intervalLikes = likes - last.likes;
  }

  const entry = new Stats({
    videoId: TRACK_VIDEO_ID,
    timestamp: new Date(),
    views,
    likes,
    intervalViews,
    intervalLikes
  });

  await entry.save();
  console.log("Saved interval:", intervalViews, intervalLikes);
});

// ===== API: START TRACKING =====
app.post("/start", async (req, res) => {
  TRACK_VIDEO_ID = req.body.videoId;
  res.json({ message: "Tracking started", videoId: TRACK_VIDEO_ID });
});

// ===== API: GET LATEST DATA =====
app.get("/current", async (req, res) => {
  const latest = await Stats.findOne().sort({ timestamp: -1 });
  res.json(latest);
});

// ===== API: FULL HISTORY =====
app.get("/history", async (req, res) => {
  const data = await Stats.find().sort({ timestamp: -1 });
  res.json(data);
});

// ===== START SERVER =====
app.listen(3000, () => console.log("Backend running on 3000"));
