# -*- coding: utf-8 -*-
# Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt
from __future__ import unicode_literals

import unittest
from unittest.mock import Mock, patch

import frappe
from helpdesk.helpdesk.doctype.hd_settings.hd_settings import HDSettings


class TestHDSettings(unittest.TestCase):
    def test_report_attachment_limits_accept_numeric_strings(self):
        settings = Mock()
        settings.get.side_effect = {
            "issue_report_max_files": "3",
            "issue_report_max_size_mb": "8",
            "issue_report_video_max_size_mb": "16",
            "issue_report_allowed_extensions": "pdf png",
        }.get
        HDSettings.validate_report_attachments(settings)

    def test_report_attachment_limits_reject_negative_numeric_strings(self):
        settings = Mock()
        settings.get.side_effect = {"issue_report_max_files": "-1"}.get
        with patch(
            "helpdesk.helpdesk.doctype.hd_settings.hd_settings._", side_effect=lambda text: text
        ), patch("frappe.throw", side_effect=frappe.ValidationError):
            with self.assertRaises(frappe.ValidationError):
                HDSettings.validate_report_attachments(settings)
