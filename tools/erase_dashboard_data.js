import { writeStorageObject } from "../aws_storage.mjs";

function eraseDashboardData() {
  writeStorageObject("dashboardRunData", {});
}

eraseDashboardData();
