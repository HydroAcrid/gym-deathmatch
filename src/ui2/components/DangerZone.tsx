"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { UserMinus, Crown, Trash2, Skull } from "lucide-react";

interface DangerZoneProps {
  lobbyName: string;
  athletes: { id: string; name: string }[];
  onRemovePlayer: (playerId: string) => void;
  onTransferOwnership: (newOwnerId: string) => void;
  onDeleteLobby: () => void;
}

export function DangerZone({
  lobbyName,
  athletes,
  onRemovePlayer,
  onTransferOwnership,
  onDeleteLobby
}: DangerZoneProps) {
  const [selectedPlayerToRemove, setSelectedPlayerToRemove] = useState("");
  const [selectedNewOwner, setSelectedNewOwner] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const canDelete = deleteConfirmation === lobbyName;

  return (
    <section className="border-2 border-destructive/50 bg-destructive/5">
      {/* Header */}
      <div className="bg-destructive/20 border-b border-destructive/30 p-4">
        <div className="flex items-center gap-3">
          <Skull className="w-5 h-5 text-destructive" />
          <h3 className="font-display text-lg font-bold tracking-wider text-destructive">
            DANGER ZONE
          </h3>
        </div>
        <p className="text-sm text-destructive/80 mt-1">
          IRREVERSIBLE ACTIONS. PROCEED WITH EXTREME CAUTION.
        </p>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Remove Player */}
        <div className="flex flex-col gap-4 p-4 border border-destructive/30 bg-background/50">
          <div className="flex-1 space-y-2">
            <label className="text-xs uppercase tracking-wider flex items-center gap-2 font-display">
              <UserMinus className="w-3 h-3 text-destructive" />
              REMOVE ATHLETE FROM LOBBY
            </label>
            <select
              value={selectedPlayerToRemove}
              onChange={(e) => setSelectedPlayerToRemove(e.target.value)}
              className="w-full h-10 px-3 bg-input border border-border font-display text-sm"
            >
              <option value="">Select athlete to remove</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Removed athletes lose all progress and cannot rejoin this season.
            </p>
          </div>
          <Button 
            variant="destructive" 
            disabled={!selectedPlayerToRemove}
            onClick={() => {
              if (confirm("Are you sure? This action is permanent.")) {
                onRemovePlayer(selectedPlayerToRemove);
              }
            }}
          >
            <UserMinus className="w-4 h-4 mr-2" />
            REMOVE
          </Button>
        </div>

        {/* Transfer Ownership */}
        <div className="flex flex-col gap-4 p-4 border border-destructive/30 bg-background/50">
          <div className="flex-1 space-y-2">
            <label className="text-xs uppercase tracking-wider flex items-center gap-2 font-display">
              <Crown className="w-3 h-3 text-arena-gold" />
              TRANSFER LOBBY OWNERSHIP
            </label>
            <select
              value={selectedNewOwner}
              onChange={(e) => setSelectedNewOwner(e.target.value)}
              className="w-full h-10 px-3 bg-input border border-border font-display text-sm"
            >
              <option value="">Select new owner</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Transfer all administrative powers to another athlete. You will become a regular member.
            </p>
          </div>
          <Button 
            variant="outline" 
            disabled={!selectedNewOwner}
            className="border-arena-gold/50 text-arena-gold hover:bg-arena-gold/10"
            onClick={() => {
              if (confirm("Are you sure you want to transfer ownership?")) {
                onTransferOwnership(selectedNewOwner);
              }
            }}
          >
            <Crown className="w-4 h-4 mr-2" />
            TRANSFER
          </Button>
        </div>

        {/* Delete Lobby */}
        <div className="p-4 border-2 border-destructive bg-destructive/10">
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="w-4 h-4 text-destructive" />
            <label className="text-xs uppercase tracking-wider text-destructive font-display">
              DELETE LOBBY PERMANENTLY
            </label>
          </div>
          <p className="text-sm text-destructive/80 mb-4">
            This will permanently delete the lobby, all seasons, all records, and all athlete data.
            This action cannot be undone under any circumstances.
          </p>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Type <span className="font-mono text-destructive">{lobbyName}</span> to confirm deletion:
            </p>
            <input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={lobbyName}
              className="w-full h-10 px-3 bg-input border border-destructive/50 font-mono text-sm"
            />
          </div>
          <Button 
            variant="destructive" 
            disabled={!canDelete}
            className="w-full mt-4"
            onClick={() => {
              if (confirm("FINAL WARNING: This will permanently destroy the lobby. Are you absolutely sure?")) {
                onDeleteLobby();
              }
            }}
          >
            <Skull className="w-4 h-4 mr-2" />
            DELETE LOBBY FOREVER
          </Button>
        </div>
      </div>
    </section>
  );
}
