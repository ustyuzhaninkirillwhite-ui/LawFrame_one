import type {
  StepInspectorPermissionsDto,
  WorkflowDataField,
} from "@lexframe/contracts";
import { describe, expect, it } from "vitest";
import {
  bindingStatusFromState,
  buildStepInspectorTabs,
  resolveInputStatus,
} from "./step-inspector-model";

describe("step inspector model", () => {
  const viewerPermissions: StepInspectorPermissionsDto = {
    can_view: true,
    can_edit_display_name: false,
    can_edit_config: false,
    can_edit_bindings: false,
    can_test_step: false,
    can_view_raw_data: false,
    can_pin_data: false,
    can_edit_error_policy: false,
    can_edit_security_policy: false,
    can_delete_step: false,
    can_open_advanced_mapping: false,
  };

  it("keeps debug hidden unless raw-data permission is present", () => {
    expect(
      buildStepInspectorTabs({
        nodeType: "legalAction",
        permissions: viewerPermissions,
      }),
    ).not.toContain("debug");
    expect(
      buildStepInspectorTabs({
        nodeType: "legalAction",
        permissions: {
          ...viewerPermissions,
          can_view_raw_data: true,
        },
      }),
    ).toContain("debug");
  });

  it("uses compact tabs for note and group nodes", () => {
    expect(
      buildStepInspectorTabs({
        nodeType: "note",
        permissions: viewerPermissions,
      }),
    ).toEqual(["overview", "settings", "errors", "outputs"]);
  });

  it("maps required unbound input to a visible missing state", () => {
    const field: WorkflowDataField = {
      key: "documents",
      label: "Documents",
      data_type: "document_ref[]",
      required: true,
    };

    const state = resolveInputStatus({ field });

    expect(state).toBe("missing_required");
    expect(bindingStatusFromState(state)).toBe("none");
  });

  it("maps policy-blocked input to a blocked binding status", () => {
    const field: WorkflowDataField = {
      key: "recipient",
      label: "Recipient",
      data_type: "string",
      required: true,
    };
    const state = resolveInputStatus({
      field,
      issues: [
        {
          id: "policy",
          severity: "policy_block",
          scope: "binding",
          code: "external_delivery_requires_approval",
          title: "Blocked",
          message: "Approval is required.",
          affected_input_key: "recipient",
        },
      ],
    });

    expect(state).toBe("blocked_by_policy");
    expect(bindingStatusFromState(state)).toBe("policy_blocked");
  });
});
