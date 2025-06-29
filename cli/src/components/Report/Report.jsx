import React, { useState, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "./report.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const GEMINI_API_KEY =
  "AIzaSyBMKBl2oHE_7uh0Xht_Ux3aKeMdmWcoBxQ" || localStorage.getItem("api");

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Topic normalization function
const normalizeTopicName = (topic) => {
  if (!topic) return topic;

  const topicLower = topic.toLowerCase().trim();

  // Define topic mappings for common variations
  const topicMappings = {
    // DSA variations - be more comprehensive
    dsa: "Data Structures & Algorithms",
    "data structure and algorithm": "Data Structures & Algorithms",
    "data structures and algorithms": "Data Structures & Algorithms",
    "data structure & algorithm": "Data Structures & Algorithms",
    "data structures & algorithms": "Data Structures & Algorithms",
    "data struture and algorithms": "Data Structures & Algorithms", // typo variation
    "ds and algo": "Data Structures & Algorithms",
    "ds & algo": "Data Structures & Algorithms",
    "ds algo": "Data Structures & Algorithms",
    "data structure": "Data Structures & Algorithms",
    "data structures": "Data Structures & Algorithms",
    algorithms: "Data Structures & Algorithms",
    algorithm: "Data Structures & Algorithms",

    // JavaScript variations
    js: "JavaScript",
    javascript: "JavaScript",
    "java script": "JavaScript",

    // React variations
    reactjs: "React",
    "react.js": "React",
    "react js": "React",

    // Node.js variations
    nodejs: "Node.js",
    "node js": "Node.js",
    "node.js": "Node.js",

    // Python variations
    python: "Python",
    python3: "Python",
    py: "Python",

    // Java variations
    java: "Java",
    "core java": "Java",

    // Add more mappings as needed
  };

  // Check if the topic has a mapping
  if (topicMappings[topicLower]) {
    return topicMappings[topicLower];
  }

  // Additional fuzzy matching for DSA-related terms
  if (
    topicLower.includes("data") &&
    (topicLower.includes("structure") || topicLower.includes("algorithm"))
  ) {
    return "Data Structures & Algorithms";
  }

  if (
    topicLower.includes("dsa") ||
    (topicLower.includes("ds") && topicLower.includes("algo"))
  ) {
    return "Data Structures & Algorithms";
  }

  // If no mapping found, return formatted version (Title Case)
  return topic
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Function to group quiz results by normalized topic
const groupQuizResultsByTopic = (quizResults) => {
  const groupedResults = {};

  quizResults.forEach((result) => {
    const normalizedTopic = normalizeTopicName(result.topic);

    if (!groupedResults[normalizedTopic]) {
      groupedResults[normalizedTopic] = {
        topic: normalizedTopic,
        originalTopic: result.topic, // Keep original for reference
        attempts: [],
        scores: [],
        dates: [],
      };
    }

    // Add all attempts to the group
    result.attempts.forEach((attempt) => {
      groupedResults[normalizedTopic].attempts.push(attempt);
      groupedResults[normalizedTopic].scores.push(attempt.score);
      groupedResults[normalizedTopic].dates.push(attempt.date || new Date());
    });
  });

  // Convert grouped results back to array format with latest/best score
  return Object.values(groupedResults).map((group) => ({
    topic: group.topic,
    originalTopic: group.originalTopic,
    attempts: group.attempts,
    // Use the latest attempt or highest score - you can modify this logic
    latestScore: group.scores[group.scores.length - 1],
    highestScore: Math.max(...group.scores),
    averageScore: Math.round(
      group.scores.reduce((a, b) => a + b, 0) / group.scores.length
    ),
    totalAttempts: group.attempts.length,
  }));
};

const Report = () => {
  const [quizResults, setQuizResults] = useState([]);
  const [normalizedQuizResults, setNormalizedQuizResults] = useState([]);
  const [learningPathways, setLearningPathways] = useState([]);
  const userId = localStorage.getItem("userId");

  useEffect(() => {
    if (userId) {
      fetch(`http://localhost:5000/api/quiz/user-quiz/${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          setQuizResults(data.quizzes);
          // Normalize the quiz results
          const normalized = groupQuizResultsByTopic(data.quizzes);
          setNormalizedQuizResults(normalized);
        })
        .catch((error) =>
          console.error("Failed to fetch quiz results:", error)
        );
    }
  }, [userId]);

  const generateBardReport = async (topic, score) => {
    try {
      const reportPrompt = `
        *Student Profile:*  
        - *Quiz Score for ${topic}*: ${score}/10  
        - *Learning Style*: Visual, prefers video-based learning  
        - *Available Study Time*: 10 minutes per week  
      
        *Task:*  
        1. Based on the quiz score for ${topic}, identify areas where the student is strong and where they need improvement.  
        2. Recommend a *personalized learning pathway* for ${topic} with topics arranged in an *optimal sequence* to strengthen weak areas and build upon existing knowledge.  
        3. Suggest *video-based resources* tailored for *visual learners*.  
        4. Break down the pathway into *weekly learning plans* that fit within a *10-minute study session per week*.  
        5. Keep the pathway *engaging, structured, and goal-oriented* to maximize efficiency.  
      
        *Output Format:*  
        Return a **valid JSON object** with the following structure:
      
        \`\`\`json
        {
          "strengths": "A brief summary of the student's strengths in ${topic}.",
          "weaknesses": "A brief summary of areas needing improvement in ${topic}.",
          "weekPlan": [
            {
              "week": "Week 1",
              "topics": "Topic name and short description",
              "resources": [
                {
                  "name": "Resource name",
                  "url": "Resource URL"
                }
              ]
            },
            {
              "week": "Week 2",
              "topics": "Another topic...",
              "resources": []
            }
          ],
          "finalMilestone": "The expected outcome after completing this learning plan.",
          "suggestedVideos": [
            {
              "name": "Video Title",
              "url": "YouTube or other video platform link"
            }
          ]
        }
        \`\`\`
        Ensure that the response is **valid JSON format** without extra markdown or text.
      `;

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(reportPrompt);
      const response = await result.response;
      let rawText = await response.text();

      rawText = rawText
        .replace(/^```json[\r\n]*/, "")
        .replace(/```[\r\n]*$/, "")
        .trim();

      return rawText;
    } catch (error) {
      console.error("Error generating report with BARD:", error);
      return "Failed to generate the report.";
    }
  };

  const generateReportsForAllTopics = async () => {
    const reportsArray = [];

    for (const result of normalizedQuizResults) {
      try {
        // Use latest score or you can use highestScore/averageScore
        const report = await generateBardReport(
          result.topic,
          result.latestScore
        );
        reportsArray.push(report);

        // Add delay between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          "Error generating report for topic:",
          result.topic,
          error
        );
        reportsArray.push(null);
      }
    }

    setLearningPathways(reportsArray.filter((report) => report !== null));
  };

  useEffect(() => {
    if (normalizedQuizResults.length > 0) {
      const fetchReports = async () => {
        await generateReportsForAllTopics();
      };
      fetchReports();
    }
  }, [normalizedQuizResults]);

  // Data for the bar chart using normalized results - simplified to one bar per topic
  const chartData = {
    labels: normalizedQuizResults.map((result) => result.topic),
    datasets: [
      {
        label: "Average Quiz Score",
        data: normalizedQuizResults.map((result) => result.averageScore),
        backgroundColor: normalizedQuizResults.map((result, index) => {
          // Color coding based on performance
          if (result.averageScore >= 8) return "rgba(34, 197, 94, 0.8)"; // Green for excellent
          if (result.averageScore >= 6) return "rgba(59, 130, 246, 0.8)"; // Blue for good
          if (result.averageScore >= 4) return "rgba(251, 191, 36, 0.8)"; // Yellow for average
          return "rgba(239, 68, 68, 0.8)"; // Red for needs improvement
        }),
        borderColor: normalizedQuizResults.map((result, index) => {
          if (result.averageScore >= 8) return "rgba(34, 197, 94, 1)";
          if (result.averageScore >= 6) return "rgba(59, 130, 246, 1)";
          if (result.averageScore >= 4) return "rgba(251, 191, 36, 1)";
          return "rgba(239, 68, 68, 1)";
        }),
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        max: 10,
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context) {
            const index = context.dataIndex;
            const result = normalizedQuizResults[index];
            return [
              `Average Score: ${result.averageScore}/10`,
              `Latest Score: ${result.latestScore}/10`,
              `Highest Score: ${result.highestScore}/10`,
              `Total Attempts: ${result.totalAttempts}`,
            ];
          },
        },
      },
      legend: {
        display: true,
        labels: {
          generateLabels: function (chart) {
            return [
              {
                text: "Performance Level",
                fillStyle: "rgba(0,0,0,0)",
                strokeStyle: "rgba(0,0,0,0)",
                lineWidth: 0,
              },
              {
                text: "Excellent (8-10)",
                fillStyle: "rgba(34, 197, 94, 0.8)",
                strokeStyle: "rgba(34, 197, 94, 1)",
                lineWidth: 2,
              },
              {
                text: "Good (6-7)",
                fillStyle: "rgba(59, 130, 246, 0.8)",
                strokeStyle: "rgba(59, 130, 246, 1)",
                lineWidth: 2,
              },
              {
                text: "Average (4-5)",
                fillStyle: "rgba(251, 191, 36, 0.8)",
                strokeStyle: "rgba(251, 191, 36, 1)",
                lineWidth: 2,
              },
              {
                text: "Needs Improvement (0-3)",
                fillStyle: "rgba(239, 68, 68, 0.8)",
                strokeStyle: "rgba(239, 68, 68, 1)",
                lineWidth: 2,
              },
            ];
          },
        },
      },
    },
  };

  return (
    <div className="report-container">
      <h2 className="report-heading">Learning Report</h2>

      <div className="chart-container">
        <h3 className="title">Your Quiz Performance</h3>
        <Bar data={chartData} options={chartOptions} />

        {/* Statistics Summary */}
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
          }}
        >
          <h4>Performance Summary</h4>
          {normalizedQuizResults.map((result, index) => (
            <div
              key={index}
              style={{
                marginBottom: "10px",
                padding: "8px",
                backgroundColor: "white",
                borderRadius: "4px",
              }}
            >
              <strong>{result.topic}</strong>
              <div style={{ fontSize: "0.9em", color: "#666" }}>
                Latest: {result.latestScore}/10 | Highest: {result.highestScore}
                /10 | Average: {result.averageScore}/10 | Attempts:{" "}
                {result.totalAttempts}
              </div>
            </div>
          ))}
        </div>
      </div>

      {learningPathways.length === 0 ? (
        <center>
          <p>Generating reports...</p>
        </center>
      ) : (
        learningPathways.map((report, index) => {
          const { topic } = normalizedQuizResults[index];
          const reportDetails = JSON.parse(report);

          return (
            <div className="topic-report" key={index}>
              <center>
                <h3 className="topic-title mb-4">Report of {topic}</h3>
              </center>

              <div className="report-section">
                <h4>Strengths</h4>
                <p>
                  {reportDetails.strengths ||
                    `Not mentioned in the context for ${topic}.`}
                </p>
              </div>

              <div className="report-section">
                <h4>Weaknesses</h4>
                <p>
                  {reportDetails.weaknesses ||
                    `Low quiz score (${normalizedQuizResults[index]?.latestScore}/10) indicates a significant gap in understanding ${topic} fundamentals.`}
                </p>
              </div>

              <div className="report-section p-3">
                <h4 className="mb-4">Week-by-Week Learning Plan</h4>
                {reportDetails.weekPlan?.map((week, i) => (
                  <div className="week-plan" key={i}>
                    <h5>{week.week} (1 Hour)</h5>
                    <p>Topics: {week.topics}</p>
                    <ul>
                      {week.resources?.map((resource, i) => (
                        <li key={i}>
                          <a href={resource.url}>{resource.name}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="report-section p-3">
                <h4 className="mb-4">
                  Final Milestone & Expected Learning Outcome
                </h4>
                <p>
                  {reportDetails.finalMilestone ||
                    `After completing this pathway, the student should have a basic understanding of ${topic} fundamentals.`}
                </p>
              </div>

              <div className="report-section p-3">
                <h4 className="mb-4">Suggested Video Resources</h4>
                <ul>
                  {reportDetails.suggestedVideos?.map((video, i) => (
                    <li key={i}>
                      <a href={video.url}>{video.name}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default Report;
