"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ArrowRight,
  ListTodo,
  Bot,
  Shield,
  BookOpen,
  Workflow,
  ExternalLink,
} from "lucide-react";

export default function Home() {
  const llmsUrl = "/llms.txt";
  const skillsUrl = "/api/v1/skills.md";
  const openApiUrl = "/api/v1/openapi.json";
  const docsUrl = "/api/v1/docs";

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <Badge variant="secondary" className="mb-4">
          Remember The Milk + AI Agents
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
          milkbridge
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Bridge Remember The Milk and your AI agents so they can collaborate
          on real work with clear ownership and safe guardrails.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/docs/getting-started">
            <Button size="lg" className="gap-2">
              Start Here <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/playbooks">
            <Button variant="outline" size="lg" className="gap-2">
              <Workflow className="h-4 w-4" /> Playbooks
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-16">
        <Card>
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
              <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle>AI-Powered Task Management</CardTitle>
            <CardDescription>
              Use natural language with Claude, Cursor, or other MCP clients to
              create, update, and organize RTM tasks.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
              <ListTodo className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Full RTM Integration</CardTitle>
            <CardDescription>
              Access all RTM features: tasks, lists, tags, notes, priorities,
              due dates, recurrence, and more through 30+ tools.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle>Secure & Private</CardTitle>
            <CardDescription>
              Use scoped workflows and dedicated agent accounts so who changed
              what is always clear.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Docs-First Hub</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/docs/getting-started">
            <Card className="h-full hover:border-primary transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Getting Started
                </CardTitle>
                <CardDescription>
                  Set up milkbridge, connect RTM, create API keys, and plug in
                  your first agent.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/playbooks">
            <Card className="h-full hover:border-primary transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-primary" />
                  Playbooks
                </CardTitle>
                <CardDescription>
                  Practical workflows for safe AI collaboration in RTM, starting
                  with dedicated collaborator accounts.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5 text-primary" />
                API & MCP Docs
              </CardTitle>
              <CardDescription>
                Inspect tool schemas, REST wrappers, and integration docs for
                your clients.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>
                <a href={docsUrl} className="text-primary hover:underline">
                  Interactive docs
                </a>
              </p>
              <p>
                <a href={openApiUrl} className="text-primary hover:underline">
                  OpenAPI
                </a>
              </p>
              <p>
                <a href={skillsUrl} className="text-primary hover:underline">
                  Skills guide
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Core Workflow</CardTitle>
          <CardDescription>
            Use a dedicated RTM account for your AI collaborator, share only the
            lists it should touch, and route work via tags or assignment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Create a separate account for the AI</p>
              <p className="text-sm text-muted-foreground">
                Keep actions and notes attributable by identity.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Share only relevant lists/tasks</p>
              <p className="text-sm text-muted-foreground">
                Use assignment or a focused tag to control scope.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">Apply guardrails</p>
              <p className="text-sm text-muted-foreground">
                Start read-and-comment first, with no complete/delete actions.
              </p>
            </div>
          </div>
          <div className="pt-4">
            <Link href="/playbooks/ai-collaborator-account">
              <Button className="w-full">Read the Collaboration Playbook</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto mt-6">
        <CardHeader>
          <CardTitle>For LLM Agents</CardTitle>
          <CardDescription>
            This homepage supports LLM discovery. For markdown-first clients,
            request <code className="font-mono">/</code> with{" "}
            <code className="font-mono">Accept: text/markdown</code> (or{" "}
            <code className="font-mono">text/md</code>) to receive{" "}
            <code className="font-mono">/llms.txt</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Primary guide:{" "}
            <a href={llmsUrl} className="text-primary hover:underline">
              {llmsUrl}
            </a>
          </p>
          <p>
            Detailed usage guide:{" "}
            <a href={skillsUrl} className="text-primary hover:underline">
              {skillsUrl}
            </a>
          </p>
          <p>
            OpenAPI spec:{" "}
            <a href={openApiUrl} className="text-primary hover:underline">
              {openApiUrl}
            </a>
          </p>
          <p>
            Interactive API docs:{" "}
            <a href={docsUrl} className="text-primary hover:underline">
              {docsUrl}
            </a>
          </p>
        </CardContent>
      </Card>

      <footer className="text-center mt-16 text-sm text-muted-foreground">
        <p>
          milkbridge •{" "}
          <a
            href="https://github.com/allen-n/rtm-mcp"
            className="text-primary hover:underline"
          >
            Open Source
          </a>
        </p>
      </footer>
    </div>
  );
}
