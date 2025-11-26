import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 3030;
const app = express();

// middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_ACCESS}@cluster0.bfqzn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Connections
    const database = client.db(process.env.DB_NAME);
    const usersCollection = database.collection("users");
    const gamesCollection = database.collection("games");

    // READING
    // USER GAMES
    app.get("/games/user", async (req, res) => {
      const email = req.query.email;
      const result = await gamesCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });
    // ALL GAMES
    app.get("/games", async (req, res) => {
      try {
        const games = await gamesCollection.find().toArray();
        res.json(games);
      } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });
    // GAME DETAILS
    app.get("/games/details", async (req, res) => {
      try {
        const { id } = req.query;
        if (!id)
          return res.status(400).json({ message: "Game ID is required" });

        const game = await gamesCollection.findOne({ _id: new ObjectId(id) });

        if (!game) return res.status(404).json({ message: "Game not found" });

        res.json(game);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", error: err.message });
      }
    });
    // GET Latest Games
    app.get("/latest/games", async (req, res) => {
      try {
        const cursor = gamesCollection
          .find({})
          .sort({ createdAt: -1 })
          .limit(6);

        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Failed to fetch latest games", error });
      }
    });

    // POSTING
    // REGISTER (POST)
    app.post("/register", async (req, res) => {
      try {
        const { name, email, password, image } = req.body;

        const exist = await usersCollection.findOne({ email });
        if (exist)
          return res.status(400).json({ message: "User already exists" });

        const newUser = {
          name,
          email,
          password,
          image: image || "",
          createdAt: new Date(),
        };

        await usersCollection.insertOne(newUser);

        res.json({ message: "Registered successfully", user: newUser });
      } catch (err) {
        res.status(500).json({ message: "Server error" });
      }
    });
    // LOGIN (POST)
    app.post("/login", async (req, res) => {
      try {
        const { email, password } = req.body;

        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.password !== password) {
          return res.status(401).json({ message: "Wrong password" });
        }

        res.json({ message: "Login success", user });
      } catch (err) {
        res.status(500).json({ message: "Server error" });
      }
    });
    // ADD GAME (POST)
    app.post("/games", async (req, res) => {
      try {
        const {
          title,
          coverImage,
          description,
          rating,
          price,
          genre,
          userEmail,
        } = req.body;

        // Required validation
        if (
          !title ||
          !coverImage ||
          !description ||
          !rating ||
          !price ||
          !genre
        ) {
          return res.status(400).json({ message: "All fields are required" });
        }

        const newGame = {
          title,
          coverImage,
          description,
          rating: Number(rating),
          price: Number(price),
          genre,
          userEmail: userEmail || null,
          createdAt: new Date(),
        };

        const result = await gamesCollection.insertOne(newGame);

        res.json({
          message: "Game added successfully",
          insertedId: result.insertedId,
          game: newGame,
        });
      } catch (err) {
        res.status(500).json({ message: "Server error" });
      }
    });

    // UPDATING
    // PUT /update-name
    app.put("/update-name", async (req, res) => {
      try {
        const { email, name } = req.body;

        if (!email || !name) {
          return res
            .status(400)
            .json({ message: "Email and Name are required" });
        }

        const result = await usersCollection.updateOne(
          { email },
          { $set: { name } }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "User not found or name unchanged" });
        }

        res.json({ message: "Name updated successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });
    // PUT /update-photo
    app.put("/update-photo", async (req, res) => {
      try {
        const { email, image } = req.body;

        if (!email || !image) {
          return res
            .status(400)
            .json({ message: "Email and Image URL are required" });
        }

        const result = await usersCollection.updateOne(
          { email },
          { $set: { image } }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "User not found or image unchanged" });
        }

        res.json({ message: "Photo updated successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // DELETING
    // GAME (DELETE)
    app.delete("/games/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await gamesCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Game not found" });
        }

        res.send({ message: "Game deleted successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("GameHub server");
});

app.listen(port, () => {
  console.log(`GameHub server listening on port ${port}`);
});
