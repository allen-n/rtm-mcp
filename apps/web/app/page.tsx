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
  Zap,
  Shield,
  ArrowRight,
  ListTodo,
  Bot,
  Code2,
} from "lucide-react";

export default function Home() {
  const llmsUrl = "/llms.txt";
  const skillsUrl = "/api/v1/skills.md";
  const openApiUrl = "/api/v1/openapi.json";
  const docsUrl = "/api/v1/docs";

  return (
    <div className="container mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <Badge variant="secondary" className="mb-4">
          Model Context Protocol
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
          RTM MCP Server
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Connect Remember The Milk to Claude, Cursor, and other AI assistants.
          Manage your tasks with natural language.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg" className="gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a
            href="https://github.com/allen-n/rtm-mcp"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="lg" className="gap-2">
              <Code2 className="h-4 w-4" /> View Source
            </Button>
          </a>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        <Card>
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
              <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle>AI-Powered Task Management</CardTitle>
            <CardDescription>
              Use natural language to create, update, and organize your tasks
              through Claude Desktop or any MCP client.
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
              due dates, recurrence, and more.
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
              Your RTM credentials are securely stored. API keys give you
              control over access to your tasks.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Tools Section */}
      <div className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          30+ MCP Tools Available
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: "get_tasks", desc: "Search and filter tasks" },
            { name: "add_task", desc: "Create with Smart Add" },
            { name: "complete_task", desc: "Mark tasks done" },
            { name: "set_due_date", desc: "Natural language dates" },
            { name: "set_priority", desc: "Prioritize work" },
            { name: "add_tags", desc: "Organize with tags" },
            { name: "add_note", desc: "Attach notes" },
            { name: "move_task", desc: "Reorganize lists" },
            { name: "set_recurrence", desc: "Repeating tasks" },
            { name: "postpone_task", desc: "Defer to tomorrow" },
            { name: "get_lists", desc: "View all lists" },
            { name: "create_list", desc: "New lists & smart lists" },
          ].map((tool) => (
            <div
              key={tool.name}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div>
                <code className="text-sm font-mono font-semibold">
                  {tool.name}
                </code>
                <p className="text-xs text-muted-foreground">{tool.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-muted-foreground mt-4">
          ...and many more tools for complete RTM control
        </p>
      </div>

      {/* Quick Start */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <p className="font-medium">Sign in with your account</p>
              <p className="text-sm text-muted-foreground">
                Create an account or sign in to get started
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <p className="font-medium">Connect Remember The Milk</p>
              <p className="text-sm text-muted-foreground">
                Authorize access to your RTM account
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <p className="font-medium">Generate an API key</p>
              <p className="text-sm text-muted-foreground">
                Use this key to authenticate your MCP client
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              4
            </div>
            <div>
              <p className="font-medium">Configure your MCP client</p>
              <p className="text-sm text-muted-foreground">
                Add the server URL and API key to Claude Desktop
              </p>
            </div>
          </div>
          <div className="pt-4">
            <Link href="/login">
              <Button className="w-full">Get Started Now</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* LLM Guidance */}
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

      {/* Footer */}
      <footer className="text-center mt-16 text-sm text-muted-foreground">
        <p>
          Built with ❤️ for the MCP ecosystem •{" "}
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
