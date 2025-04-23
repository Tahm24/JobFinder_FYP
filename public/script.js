document.getElementById("upload-form").addEventListener("submit", function (event) {
    event.preventDefault();

    let formData = new FormData();
    let fileInput = document.getElementById("resume");
    formData.append("resume", fileInput.files[0]);

    fetch("/upload", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.jobs) {
            displayResults(data.jobs);
        } else {
            document.getElementById("results").innerHTML = "<p>Error processing resume.</p>";
        }
    })
    .catch(error => console.error("Error:", error));
});

function displayResults(jobs) {
    let resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "<h3>Matching Jobs</h3>";

    jobs.forEach(job => {
        let jobDiv = document.createElement("div");
        jobDiv.classList.add("job-item");
        jobDiv.innerHTML = `
            <h4>${job.title}</h4>
            <p>${job.description}</p>
            <strong>Match Score: ${(job.score * 100).toFixed(2)}%</strong>
            <hr>
        `;
        resultsDiv.appendChild(jobDiv);
    });
}
