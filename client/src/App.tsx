import { Button } from "@/components/ui/button";
import { useState } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import RoutesManager from "./router/RoutesManager";

const router = createBrowserRouter([
  {
    path: "*",
    element: <RoutesManager />,
  }
]);

function App() {
	return (
		<RouterProvider router={router} />
	);
}

export default App;
