const express = require("express");
const app = express();
const dotenv = require("dotenv");
import userRouter from "./routers/user";
import workerRouter from "./routers/worker";
import cors from "cors";
dotenv.config({ path: __dirname + "/.env" });

app.use(express.json());
app.use(cors());

app.use("/v1/user", userRouter);
app.use("/v1/worker", workerRouter);

app.listen(3000, () => console.log("App is running on port 3000"));
