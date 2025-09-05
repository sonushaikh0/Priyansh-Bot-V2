module.exports.config = {
	name: "video",
	version: "1.0.0",
	hasPermssion: 0,
	credits: "Aman Khan",
	description: "YouTube se video download karo",
	commandCategory: "media",
	usages: "video [song name]",
	cooldowns: 10,
	dependencies: {
		"ytdl-core": "",
		"fs-extra": "",
		"axios": "",
		"yt-search": ""
	}
};

const ytdl = global.nodemodule["ytdl-core"];
const fs = global.nodemodule["fs-extra"];
const path = global.nodemodule["path"];
const yts = global.nodemodule["yt-search"];

module.exports.run = async function({ api, event, args }) {
	const keyword = args.join(" ");
	
	if (!keyword) {
		return api.sendMessage("❌ Koi song name dalo bhai...\nExample: .video Saiyara Song", event.threadID, event.messageID);
	}
	
	try {
		api.sendMessage(`🔍 Searching "${keyword}" on YouTube...`, event.threadID, (err, info) => {
			setTimeout(() => { api.unsendMessage(info.messageID) }, 5000);
		});

		// yt-search package use karte hain
		const searchResults = await yts(keyword);
		
		if (!searchResults.videos || searchResults.videos.length === 0) {
			return api.sendMessage("❌ Koi video nahi mila bhai...", event.threadID, event.messageID);
		}
		
		const videos = searchResults.videos.slice(0, 5);
		const links = videos.map(video => video.url);
		const titles = videos.map((video, index) => `${index + 1}. ${video.title} (${video.timestamp})`);
		
		api.sendMessage(`🎬 Results for "${keyword}":\n\n${titles.join('\n')}\n\nReply with number (1-5) to download`, event.threadID, (error, info) => {
			global.client.handleReply.push({
				name: this.config.name,
				messageID: info.messageID,
				author: event.senderID,
				link: links
			});
		});
		
	} catch (error) {
		console.error("Search Error:", error);
		api.sendMessage("❌ Search mein error aa gaya bhai.", event.threadID, event.messageID);
	}
};

module.exports.handleReply = async function({ api, event, handleReply }) {
	if (event.senderID != handleReply.author) return;
	
	const index = parseInt(event.body) - 1;
	if (isNaN(index) || index < 0 || index >= handleReply.link.length) {
		return api.sendMessage("❌ Sahi number dalo bhai (1-5)...", event.threadID, event.messageID);
	}
	
	try {
		const videoUrl = handleReply.link[index];
		
		api.sendMessage(`⬇️ Downloading video...`, event.threadID, (err, info) => {
			setTimeout(() => { api.unsendMessage(info.messageID) }, 15000);
		});
		
		await downloadAndSendVideo(api, event, videoUrl);
	} catch (error) {
		console.error("Download Error:", error);
		api.sendMessage("❌ Video download nahi ho paya.", event.threadID, event.messageID);
	}
};

async function downloadAndSendVideo(api, event, url) {
	let videoPath;
	try {
		const videoInfo = await ytdl.getInfo(url);
		const videoTitle = videoInfo.videoDetails.title;
		const videoDuration = parseInt(videoInfo.videoDetails.lengthSeconds);
		
		// 10 minutes tak ka video allow karte hain
		if (videoDuration > 600) {
			return api.sendMessage("❌ Video bahut lamba hai (max 10 minutes).", event.threadID, event.messageID);
		}
		
		videoPath = path.join(__dirname, 'cache', `video_${Date.now()}.mp4`);
		
		// Cache folder banayein agar nahi hai toh
		if (!fs.existsSync(path.join(__dirname, 'cache'))) {
			fs.mkdirSync(path.join(__dirname, 'cache'));
		}
		
		// MP4 format mein best quality ke liye
		const videoStream = ytdl(url, {
			quality: 'lowest', // Lowest quality for smaller size
			filter: format => format.container === 'mp4' && format.hasVideo && format.hasAudio
		});
		
		const writeStream = fs.createWriteStream(videoPath);
		
		videoStream.pipe(writeStream);
		
		writeStream.on('finish', async () => {
			try {
				const stats = fs.statSync(videoPath);
				const fileSize = stats.size;
				
				// 25MB tak allow karte hain
				if (fileSize > 25 * 1024 * 1024) {
					fs.unlinkSync(videoPath);
					return api.sendMessage("❌ Video file bahut bada hai (max 25MB).", event.threadID, event.messageID);
				}
				
				api.sendMessage({
					body: `🎬 ${videoTitle}\n\n✅ By Aman Khan`,
					attachment: fs.createReadStream(videoPath)
				}, event.threadID, () => {
					// Send hone ke baad file delete karo
					try {
						if (fs.existsSync(videoPath)) {
							fs.unlinkSync(videoPath);
						}
					} catch (e) {
						console.error("File delete error:", e);
					}
				}, event.messageID);
				
			} catch (error) {
				console.error("File Processing Error:", error);
				api.sendMessage("❌ Video send karne mein error aa gaya.", event.threadID, event.messageID);
			}
		});
		
		videoStream.on('error', (error) => {
			console.error("Stream Error:", error);
			api.sendMessage("❌ Video stream mein error aa gaya.", event.threadID, event.messageID);
		});
		
		writeStream.on('error', (error) => {
			console.error("Write Error:", error);
			api.sendMessage("❌ File save nahi ho payi.", event.threadID, event.messageID);
		});
		
	} catch (error) {
		console.error("Download Function Error:", error);
		api.sendMessage("❌ Video download process mein error aa gaya.", event.threadID, event.messageID);
	}
}
