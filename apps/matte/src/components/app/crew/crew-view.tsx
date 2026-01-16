"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@drip/core/database/server";
import { formatDate, copyToClipboard, generateToken } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Users, Trash2, UserPlus } from "lucide-react";

interface CrewViewProps {
  companyId: string;
  companyOwnerId: string;
  currentUserId: string;
  isOwner: boolean;
  teamMembers: {
    id: string;
    email: string;
    fullName: string;
    joinedAt: string;
  }[];
}

export function CrewView({
  companyId,
  companyOwnerId,
  currentUserId,
  isOwner,
  teamMembers: initialMembers,
}: CrewViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  const [creating, setCreating] = useState(false);

  async function handleCreateAndCopyInviteLink() {
    setCreating(true);
    try {
      const token = generateToken(24);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase
        .from("invite_links")
        .insert({
          company_id: companyId,
          token,
          expires_at: expiresAt.toISOString(),
          created_by_user_id: currentUserId,
        });

      if (error) throw error;

      const inviteUrl = `${window.location.origin}/join/${token}`;
      copyToClipboard(inviteUrl);
      addToast("Invite link copied! Share it with your crew.", "success");
    } catch {
      addToast("Failed to create invite link", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleRemoveUser(userId: string) {
    if (userId === currentUserId) {
      addToast("You cannot remove yourself", "error");
      return;
    }

    if (!confirm("Remove this crew member?")) return;

    const { error } = await supabase
      .from("company_users")
      .delete()
      .eq("user_id", userId)
      .eq("company_id", companyId);

    if (error) {
      addToast("Failed to remove crew member", "error");
      return;
    }

    router.refresh();
    addToast("Crew member removed", "success");
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Crew</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your painting crew. Everyone has access to all jobs, customers, and estimates.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Crew Members */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Crew Members</h3>
              <p className="text-sm text-muted-foreground">
                {initialMembers.length} {initialMembers.length === 1 ? "member" : "members"}
              </p>
            </div>
            <Button onClick={handleCreateAndCopyInviteLink} loading={creating}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Crew Member
            </Button>
          </div>

          <div className="divide-y">
            {initialMembers.map((member) => (
              <div
                key={member.id}
                className="py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {member.fullName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.fullName}
                      {member.id === companyOwnerId && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Owner)
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDate(member.joinedAt)}
                    </p>
                  </div>
                </div>
                {isOwner && member.id !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveUser(member.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Info Card */}
        <div className="rounded-lg border bg-muted/50 p-6">
          <h3 className="font-semibold mb-2">How it works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Create an invite link and share it with your crew members</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>They'll create an account and automatically join your company</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Everyone sees the same jobs, customers, estimates, and invoices</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Invite links expire after 7 days for security</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
