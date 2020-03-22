# Migration `20200322152628-test`

This migration has been generated by Emanuel Joebstl at 3/22/2020, 3:26:28 PM.
You can check out the [state of the schema](./schema.prisma) after the migration.

## Database Steps

```sql
ALTER TYPE "EventType" ADD VALUE 'Location';
ALTER TYPE "EventType" ADD VALUE 'Interaction';
ALTER TYPE "EventType" ADD VALUE 'Sympthoms';
ALTER TYPE "EventType" ADD VALUE 'DiagnosedSick';
ALTER TYPE "EventType" ADD VALUE 'MarkerSick'
```

## Changes

```diff
diff --git schema.prisma schema.prisma
migration 20200322152536-event-id-autoinc..20200322152628-test
--- datamodel.dml
+++ datamodel.dml
@@ -2,9 +2,9 @@
 // learn more about it in the docs: https://pris.ly/d/prisma-schema
 datasource db {
   provider = "postgresql"
-  url = "***"
+  url      = env("DATABASE_URL")
 }
 generator client {
   provider = "prisma-client-js"
@@ -34,10 +34,15 @@
 enum EventType {
   // Having travelled in a high risk area before
   HighRiskArea
-  // Moving to another part of Germany. Location
-  // Social interaction with another user Interaction
-  // Developed Sympthoms Sympthoms
-  // Diagnosed Sick DiagnosedSick
-  // Marker inserted in past timeline when covid is diagnosed, to ease model calculation. MarkerSick
+  // Moving to another part of Germany.
+  Location
+  // Social interaction with another user
+  Interaction
+  // Developed Sympthoms
+  Sympthoms
+  // Diagnosed Sick
+  DiagnosedSick
+  // Marker inserted in past timeline when covid is diagnosed, to ease model calculation.
+  MarkerSick 
 }
```

