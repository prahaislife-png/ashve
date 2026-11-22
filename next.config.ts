import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

// Enables "use workflow" / "use step" for the background jobs in src/workflows.
export default withWorkflow(nextConfig);
