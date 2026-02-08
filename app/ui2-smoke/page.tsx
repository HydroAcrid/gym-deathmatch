"use client";

import { useState } from "react";
import { Button } from "@/src/ui2/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/src/ui2/ui/card";
import { Input } from "@/src/ui2/ui/input";
import { Textarea } from "@/src/ui2/ui/textarea";
import { Badge } from "@/src/ui2/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/ui2/ui/tabs";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/src/ui2/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/src/ui2/ui/select";
import { Separator } from "@/src/ui2/ui/separator";
import { Toaster } from "@/src/ui2/ui/toaster";
import { toast } from "@/src/ui2/ui/use-toast";

export default function Ui2SmokePage() {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<div className="min-h-screen px-6 py-10">
			<div className="mx-auto max-w-4xl space-y-8">
				<header className="space-y-2">
					<h1 className="text-3xl">UI2 Smoke Test</h1>
					<p className="text-muted-foreground text-sm">
						Base UI components imported from arena-deathmatch.
					</p>
					<div className="flex flex-wrap gap-2">
						<Badge>Default</Badge>
						<Badge variant="secondary">Secondary</Badge>
						<Badge variant="destructive">Destructive</Badge>
						<Badge variant="outline">Outline</Badge>
					</div>
				</header>

				<Separator />

				<div className="grid gap-6 md:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Buttons</CardTitle>
							<CardDescription>Variants + sizes</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-wrap gap-2">
							<Button>Default</Button>
							<Button variant="secondary">Secondary</Button>
							<Button variant="destructive">Destructive</Button>
							<Button variant="outline">Outline</Button>
							<Button variant="arena">Arena</Button>
							<Button variant="arenaGold">Arena Gold</Button>
						</CardContent>
						<CardFooter>
							<Button
								variant="arenaPrimary"
								onClick={() =>
									toast({ title: "Toast", description: "UI2 toast rendered." })
								}
							>
								Show toast
							</Button>
						</CardFooter>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Inputs</CardTitle>
							<CardDescription>Input, textarea, select</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<Input placeholder="Athlete name" />
							<Textarea placeholder="Notes" />
							<Select>
								<SelectTrigger>
									<SelectValue placeholder="Select mode" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="survival">Survival</SelectItem>
									<SelectItem value="roulette">Roulette</SelectItem>
									<SelectItem value="cumulative">Cumulative</SelectItem>
								</SelectContent>
							</Select>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Tabs + Dialog</CardTitle>
						<CardDescription>Interactive primitives</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Tabs defaultValue="arena">
							<TabsList>
								<TabsTrigger value="arena">Arena</TabsTrigger>
								<TabsTrigger value="lobby">Lobby</TabsTrigger>
							</TabsList>
							<TabsContent value="arena" className="text-sm text-muted-foreground">
								Arena components render here.
							</TabsContent>
							<TabsContent value="lobby" className="text-sm text-muted-foreground">
								Lobby components render here.
							</TabsContent>
						</Tabs>

						<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
							<DialogTrigger asChild>
								<Button variant="arena">Open dialog</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>UI2 Dialog</DialogTitle>
									<DialogDescription>
										Dialog content from the imported UI kit.
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<Button variant="secondary" onClick={() => setDialogOpen(false)}>
										Close
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</CardContent>
				</Card>
			</div>
			<Toaster />
		</div>
	);
}
