document.addEventListener("DOMContentLoaded", function() {
    fetch('/api/videos')
        .then(response => response.json())
        .then(videos => {
            let videoHtml = '';
            videos.forEach(video => {
                videoHtml += `
                    <div class="video-card" onclick="showVideo('${video.url}', '${video.title}', '${video.instructor}', '${video.duration}')">
                        <img src="${video.thumbnail}" alt="Thumbnail">
                        <div class="video-info">
                            <h6>${video.session} - ${video.title}</h6>
                            <p>${video.activity} | ${video.instructor} | ${video.duration}</p>
                        </div>
                    </div>
                `;
            });
            document.getElementById('video-list').innerHTML = videoHtml;
        })
        .catch(error => console.error('비디오 데이터 로드 오류:', error));
});
