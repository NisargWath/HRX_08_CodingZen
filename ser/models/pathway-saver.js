const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Import your existing models
const User = require("./models/userModel");
const Roadmap = require("./models/roadmapModel");
const Quiz = require("./models/quizModel");
const QuizAttempt = require("./models/quizAttemptSchema");
const Checkpoint = require("./models/checkpointSchema");

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/Hackpalloti")
  .then(() => {
    console.log("Connected to MongoDB for pathway export");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB", err);
  });

/**
 * Save complete pathway data for all users
 */
const saveCompletePathwayData = async () => {
  try {
    console.log("Starting complete pathway data export...");

    // Fetch all users with populated roadmaps and checkpoints
    const users = await User.find({})
      .populate({
        path: "roadmaps",
        populate: {
          path: "checkpoints",
          model: "Checkpoint",
        },
      })
      .lean(); // Use lean() for better performance and plain objects

    const pathwayData = {
      exportDate: new Date().toISOString(),
      totalUsers: users.length,
      users: [],
    };

    for (const user of users) {
      const userData = {
        userId: user._id,
        name: user.name,
        email: user.email,
        learningParameters: user.learningParameters,
        surveyParameters: user.surveyParameters,
        roadmaps: [],
      };

      // Process each roadmap
      for (const roadmap of user.roadmaps) {
        const roadmapData = {
          roadmapId: roadmap._id,
          mainTopic: roadmap.mainTopic,
          description: roadmap.description,
          difficulty: roadmap.difficulty,
          estimatedDuration: roadmap.estimatedDuration,
          totalProgress: roadmap.totalProgress,
          status: roadmap.status,
          createdAt: roadmap.createdAt,
          checkpoints: roadmap.checkpoints.map((checkpoint) => ({
            checkpointId: checkpoint._id,
            title: checkpoint.title,
            description: checkpoint.description,
            order: checkpoint.order,
            status: checkpoint.status,
            completedAt: checkpoint.completedAt,
            resources: checkpoint.resources,
          })),
        };

        // Get quizzes related to this roadmap topic
        const quizzes = await Quiz.find({
          topic: { $regex: roadmap.mainTopic, $options: "i" },
        }).lean();

        roadmapData.quizzes = quizzes.map((quiz) => ({
          quizId: quiz._id,
          title: quiz.title,
          topic: quiz.topic,
          difficulty: quiz.difficulty,
          domain: quiz.domain,
          tags: quiz.tags,
          questions: quiz.questions,
          createdAt: quiz.createdAt,
        }));

        // Get quiz attempts for this user and related quizzes
        const quizAttempts = await QuizAttempt.find({
          user: user._id,
          quiz: { $in: quizzes.map((q) => q._id) },
        }).lean();

        roadmapData.quizAttempts = quizAttempts.map((attempt) => ({
          attemptId: attempt._id,
          quizId: attempt.quiz,
          score: attempt.score,
          totalQuestions: attempt.totalQuestions,
          correctAnswers: attempt.correctAnswers,
          completedAt: attempt.completedAt,
          timeTaken: attempt.timeTaken,
        }));

        userData.roadmaps.push(roadmapData);
      }

      pathwayData.users.push(userData);
    }

    // Save to JSON file
    const fileName = `pathway_data_${
      new Date().toISOString().split("T")[0]
    }.json`;
    const filePath = path.join(__dirname, "exports", fileName);

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(__dirname, "exports");
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(pathwayData, null, 2));
    console.log(`Complete pathway data saved to: ${filePath}`);
    console.log(`Total users exported: ${pathwayData.totalUsers}`);

    return pathwayData;
  } catch (error) {
    console.error("Error saving pathway data:", error);
    throw error;
  }
};

/**
 * Save pathway data for a specific user
 */
const saveUserPathwayData = async (userId) => {
  try {
    console.log(`Saving pathway data for user: ${userId}`);

    const user = await User.findById(userId)
      .populate({
        path: "roadmaps",
        populate: {
          path: "checkpoints",
          model: "Checkpoint",
        },
      })
      .lean();

    if (!user) {
      throw new Error("User not found");
    }

    const userData = {
      exportDate: new Date().toISOString(),
      userId: user._id,
      name: user.name,
      email: user.email,
      learningParameters: user.learningParameters,
      surveyParameters: user.surveyParameters,
      roadmaps: [],
    };

    // Process roadmaps (same logic as above)
    for (const roadmap of user.roadmaps) {
      const roadmapData = {
        roadmapId: roadmap._id,
        mainTopic: roadmap.mainTopic,
        description: roadmap.description,
        difficulty: roadmap.difficulty,
        estimatedDuration: roadmap.estimatedDuration,
        totalProgress: roadmap.totalProgress,
        status: roadmap.status,
        createdAt: roadmap.createdAt,
        checkpoints: roadmap.checkpoints.map((checkpoint) => ({
          checkpointId: checkpoint._id,
          title: checkpoint.title,
          description: checkpoint.description,
          order: checkpoint.order,
          status: checkpoint.status,
          completedAt: checkpoint.completedAt,
          resources: checkpoint.resources,
        })),
      };

      const quizzes = await Quiz.find({
        topic: { $regex: roadmap.mainTopic, $options: "i" },
      }).lean();

      roadmapData.quizzes = quizzes.map((quiz) => ({
        quizId: quiz._id,
        title: quiz.title,
        topic: quiz.topic,
        difficulty: quiz.difficulty,
        domain: quiz.domain,
        tags: quiz.tags,
        questions: quiz.questions,
        createdAt: quiz.createdAt,
      }));

      const quizAttempts = await QuizAttempt.find({
        user: user._id,
        quiz: { $in: quizzes.map((q) => q._id) },
      }).lean();

      roadmapData.quizAttempts = quizAttempts.map((attempt) => ({
        attemptId: attempt._id,
        quizId: attempt.quiz,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        correctAnswers: attempt.correctAnswers,
        completedAt: attempt.completedAt,
        timeTaken: attempt.timeTaken,
      }));

      userData.roadmaps.push(roadmapData);
    }

    // Save user-specific file
    const fileName = `user_pathway_${user.name.replace(
      /\s+/g,
      "_"
    )}_${userId}_${new Date().toISOString().split("T")[0]}.json`;
    const filePath = path.join(__dirname, "exports", fileName);

    const exportsDir = path.join(__dirname, "exports");
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
    console.log(`User pathway data saved to: ${filePath}`);

    return userData;
  } catch (error) {
    console.error("Error saving user pathway data:", error);
    throw error;
  }
};

/**
 * Generate pathway statistics
 */
const generatePathwayStats = async () => {
  try {
    console.log("Generating pathway statistics...");

    const totalUsers = await User.countDocuments();
    const totalRoadmaps = await Roadmap.countDocuments();
    const totalQuizzes = await Quiz.countDocuments();
    const totalCheckpoints = await Checkpoint.countDocuments();
    const totalQuizAttempts = await QuizAttempt.countDocuments();

    // Completion rates
    const completedCheckpoints = await Checkpoint.countDocuments({
      status: "completed",
    });
    const completionRate =
      totalCheckpoints > 0
        ? ((completedCheckpoints / totalCheckpoints) * 100).toFixed(2)
        : 0;

    // Average progress per roadmap
    const roadmaps = await Roadmap.find({}, "totalProgress").lean();
    const avgProgress =
      roadmaps.length > 0
        ? (
            roadmaps.reduce((sum, r) => sum + (r.totalProgress || 0), 0) /
            roadmaps.length
          ).toFixed(2)
        : 0;

    // Quiz performance
    const quizAttempts = await QuizAttempt.find({}, "score").lean();
    const avgQuizScore =
      quizAttempts.length > 0
        ? (
            quizAttempts.reduce((sum, attempt) => sum + attempt.score, 0) /
            quizAttempts.length
          ).toFixed(2)
        : 0;

    // Domain distribution
    const domainStats = await Quiz.aggregate([
      { $group: { _id: "$domain", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const stats = {
      generatedAt: new Date().toISOString(),
      totals: {
        users: totalUsers,
        roadmaps: totalRoadmaps,
        quizzes: totalQuizzes,
        checkpoints: totalCheckpoints,
        quizAttempts: totalQuizAttempts,
      },
      performance: {
        checkpointCompletionRate: `${completionRate}%`,
        averageRoadmapProgress: avgProgress,
        averageQuizScore: avgQuizScore,
      },
      domainDistribution: domainStats,
    };

    const statsPath = path.join(
      __dirname,
      "exports",
      `pathway_stats_${new Date().toISOString().split("T")[0]}.json`
    );
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));

    console.log("Pathway statistics generated:", stats);
    console.log(`Statistics saved to: ${statsPath}`);

    return stats;
  } catch (error) {
    console.error("Error generating pathway statistics:", error);
    throw error;
  }
};

/**
 * Export pathway data in different formats
 */
const exportPathwayData = async (format = "json", userId = null) => {
  try {
    let data;

    if (userId) {
      data = await saveUserPathwayData(userId);
    } else {
      data = await saveCompletePathwayData();
    }

    if (format === "csv") {
      // Convert to CSV format for roadmaps
      const csvData = [];
      const users = userId ? [data] : data.users;

      users.forEach((user) => {
        user.roadmaps.forEach((roadmap) => {
          roadmap.checkpoints.forEach((checkpoint) => {
            csvData.push({
              userId: user.userId,
              userName: user.name,
              userEmail: user.email,
              roadmapId: roadmap.roadmapId,
              roadmapTopic: roadmap.mainTopic,
              roadmapProgress: roadmap.totalProgress,
              checkpointId: checkpoint.checkpointId,
              checkpointTitle: checkpoint.title,
              checkpointStatus: checkpoint.status,
              checkpointOrder: checkpoint.order,
              completedAt: checkpoint.completedAt,
            });
          });
        });
      });

      const csv = convertToCSV(csvData);
      const csvFileName = userId
        ? `user_pathway_${userId}_${new Date().toISOString().split("T")[0]}.csv`
        : `pathway_data_${new Date().toISOString().split("T")[0]}.csv`;

      const csvPath = path.join(__dirname, "exports", csvFileName);
      fs.writeFileSync(csvPath, csv);
      console.log(`CSV data saved to: ${csvPath}`);
    }

    return data;
  } catch (error) {
    console.error("Error exporting pathway data:", error);
    throw error;
  }
};

/**
 * Helper function to convert JSON to CSV
 */
const convertToCSV = (data) => {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];

  data.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header];
      return typeof value === "string"
        ? `"${value.replace(/"/g, '""')}"`
        : value;
    });
    csvRows.push(values.join(","));
  });

  return csvRows.join("\n");
};

// Main execution function
const main = async () => {
  try {
    console.log("Starting pathway data export process...");

    // Generate statistics
    await generatePathwayStats();

    // Save complete pathway data
    await saveCompletePathwayData();

    // Export in CSV format as well
    await exportPathwayData("csv");

    console.log("Pathway data export completed successfully!");
  } catch (error) {
    console.error("Error in main execution:", error);
  } finally {
    mongoose.connection.close();
    console.log("Database connection closed.");
  }
};

// Export functions for use in other modules
module.exports = {
  saveCompletePathwayData,
  saveUserPathwayData,
  generatePathwayStats,
  exportPathwayData,
};

// Run if called directly
if (require.main === module) {
  main();
}
