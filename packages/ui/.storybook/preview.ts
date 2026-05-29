import type { Preview } from "@storybook/react-vite";
import "../src/styles/index.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "brand-black",
      values: [
        { name: "brand-black", value: "#0a0a0a" },
        { name: "brand-surface", value: "#111110" },
        { name: "brand-white", value: "#f5f4f0" },
        { name: "otocho-canvas", value: "#16150f" },
      ],
    },
  },
};

export default preview;
