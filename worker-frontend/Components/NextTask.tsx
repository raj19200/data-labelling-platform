import { BACKEND_URL } from "@/utils";
import axios from "axios";

import { useEffect, useState } from "react";
interface Task {
  id: number;
  options: {
    id: number;
    image_url: string;
    task_id: number;
  }[];
  title: string;
  amount: number;
}
interface NextTaskProps {
  value: boolean;
}
export const NextTask: React.FC<NextTaskProps> = ({ value }) => {
  const [currentTask, setNextTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSignIn, setisSignIn] = useState(false);

  useEffect(() => {
    setLoading(true);

    axios
      .get(`${BACKEND_URL}/v1/worker/nextTask`, {
        headers: {
          Authorization: localStorage.getItem("token"),
        },
      })
      .then((res) => {
        setNextTask(res.data.task);
        setLoading(false);
      })
      .catch((e) => {
        setLoading(false);
        setNextTask(null);
      });
  }, []);
  if (!value) {
    return (
      <div className="h-screen flex justify-center flex-col">
        <div className="w-screen flex justify-center text-2xl">
          Please Sign-In to view your task.....
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="h-screen flex justify-center flex-col">
        <div className="w-screen flex justify-center text-2xl">
          Loading.....
        </div>
      </div>
    );
  }
  if (!currentTask) {
    return (
      <div className="h-screen flex justify-center flex-col">
        <div className="w-screen flex justify-center text-2xl">
          There are no task at the moment. Please check back after some times.
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-2xl pt-20 flex justify-center">
        {currentTask.title}
        {submitting && "Submitting...."}
      </div>
      <div className="flex justify-center pt-8">
        {currentTask.options.map((option) => (
          <Option
            key={option.id}
            imageUrl={option.image_url}
            onSelect={async () => {
              setSubmitting(true);
              try {
                const response = await axios.post(
                  `${BACKEND_URL}/v1/worker/submission`,
                  {
                    taskId: currentTask.id.toString(),
                    selection: option.id.toString(),
                  },
                  {
                    headers: {
                      Authorization: localStorage.getItem("token"),
                    },
                  }
                );
                const nextTask = response.data.nextTask;
                if (nextTask) {
                  setNextTask(nextTask);
                } else {
                  setNextTask(null);
                }
              } catch (e) {
                console.log(e);
              }
              setSubmitting(false);
            }}
          />
        ))}
      </div>
    </div>
  );
};

function Option({
  imageUrl,
  onSelect,
}: {
  imageUrl: string;
  onSelect: () => void;
}) {
  return (
    <div>
      <img
        onClick={onSelect}
        className={"p-2 w-96 rounded-md"}
        src={imageUrl}
        alt="Task Details"
      />
    </div>
  );
}
