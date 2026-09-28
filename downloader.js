const BACKEND_URL = "https://video-downloader-rfpe.onrender.com";

  const fetchBtn = document.getElementById("fetchBtn");
  const urlInput = document.getElementById("videoUrl");
  const statusEl = document.getElementById("status");
  const loadingEl = document.getElementById("loading");
  const resultEl = document.getElementById("result");
  const qualitiesEl = document.getElementById("qualities");
  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("mainNav");

  navToggle.addEventListener("click", () => mainNav.classList.toggle("open"));

  fetchBtn.addEventListener("click", fetchVideoInfo);
  urlInput.addEventListener("keypress", (e) => { if (e.key === "Enter") fetchVideoInfo(); });

  function detectPlatform(url) {
    url = url.toLowerCase();
    if (url.includes("instagram.com")) return "Instagram";
    if (url.includes("tiktok.com")) return "TikTok";
    return null;
  }

  async function fetchVideoInfo() {
    const url = urlInput.value.trim();
    if (!url) { showStatus("Please paste a link first !", true); return; }

    resultEl.classList.remove("show");
    loadingEl.classList.add("show");
    showStatus("");
    fetchBtn.disabled = true;

    try {
      const res = await fetch(`${BACKEND_URL}/api/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Something Went Wrong");

      document.getElementById("thumb").src = data.thumbnail || "";
      document.getElementById("videoTitle").innerText = data.title || "Untitled Video";
      document.getElementById("platTag").innerText = data.platform || detectPlatform(url) || "video";

      qualitiesEl.innerHTML = "";
      data.formats.forEach((f) => {
        const row = document.createElement("div");
        row.className = "quality-row";
        const sizeText = f.filesize ? `${(f.filesize / (1024 * 1024)).toFixed(1)} MB` : "";
        row.innerHTML = `
          <span class="q-left">
            <span class="q-label">${f.quality}</span>
            <span class="q-size">${sizeText}</span>
          </span>
          <span class="q-download">Download ↓</span>
        `;
        row.onclick = () => downloadVideo(url, f.format_id);
        qualitiesEl.appendChild(row);
      });

      resultEl.classList.add("show");
    } catch (err) {
      showStatus(err.message, true);
    } finally {
      loadingEl.classList.remove("show");
      fetchBtn.disabled = false;
    }
  }

  function downloadVideo(url, formatId) {
    pollDownload(url, formatId);
  }

  async function pollDownload(url, formatId) {
    showStatus("Adding to Queue...");
    try {
      const createRes = await fetch(`${BACKEND_URL}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format_id: formatId }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.detail || "Could not start the job");

      const jobId = createData.job_id;

      const poll = async () => {
        const res = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Status check failed");

        if (data.status === "queued") {
          showStatus("Your video is in the Queue, Please Wait a Moment...");
          setTimeout(poll, 2000);
        } else if (data.status === "processing") {
          showStatus("Your Video is Processing, Please Wait...");
          setTimeout(poll, 2000);
        } else if (data.status === "done") {
          showStatus("✓ Ready! Downloading is Started...");
          const fileUrl = `${BACKEND_URL}/api/jobs/${jobId}/file`;
          const a = document.createElement("a");
          a.href = fileUrl;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else if (data.status === "failed") {
          showStatus(data.error || "Download failed", true);
        }
      };

      poll();
    } catch (err) {
      showStatus(err.message, true);
    }
  }

  function showStatus(msg, isError = false) {
    statusEl.innerText = msg;
    statusEl.className = "status-line" + (isError ? " error" : "");
  }
