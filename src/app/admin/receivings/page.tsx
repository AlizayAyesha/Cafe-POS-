import { redirect } from "next/navigation";

export default function ReceivingsRedirect() {
  redirect("/admin/inventory");
}
