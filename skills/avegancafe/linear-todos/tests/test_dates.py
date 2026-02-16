"""Tests for the dates module."""

from datetime import datetime

import pytest

from linear_todos.dates import DateParser


class TestDateParser:
    """Test cases for DateParser class."""
    
    def test_parse_today(self):
        """Test parsing 'today'."""
        base = datetime(2025, 2, 15)
        result = DateParser.parse("today", base)
        assert result == "2025-02-15"
    
    def test_parse_tomorrow(self):
        """Test parsing 'tomorrow'."""
        base = datetime(2025, 2, 15)
        result = DateParser.parse("tomorrow", base)
        assert result == "2025-02-16"
    
    def test_parse_in_days(self):
        """Test parsing 'in X days'."""
        base = datetime(2025, 2, 15)
        result = DateParser.parse("in 3 days", base)
        assert result == "2025-02-18"
    
    def test_parse_in_weeks(self):
        """Test parsing 'in X weeks'."""
        base = datetime(2025, 2, 15)
        result = DateParser.parse("in 2 weeks", base)
        assert result == "2025-03-01"
    
    def test_parse_iso_date(self):
        """Test parsing ISO date format."""
        result = DateParser.parse("2025-04-15")
        assert result == "2025-04-15"
    
    def test_parse_invalid_date(self):
        """Test parsing invalid date returns None."""
        result = DateParser.parse("not a valid date")
        assert result is None
    
    def test_parse_empty_string(self):
        """Test parsing empty string returns None."""
        result = DateParser.parse("")
        assert result is None
    
    def test_parse_next_weekday(self):
        """Test parsing 'next Monday', 'next Tuesday', etc."""
        # Saturday Feb 15, 2025
        base = datetime(2025, 2, 15)
        
        # Next Monday should be Feb 24 (not Feb 17, because "next" means following week)
        # Saturday (6) -> Monday (1): (7-6)+1 = 2 days to next Monday, but +7 for "next" = 9 days
        result = DateParser.parse("next monday", base)
        assert result == "2025-02-24"
        
        # Next Friday should be Feb 28 (not Feb 21, because "next" means following week)
        # Saturday (6) -> Friday (5): (7-6)+5 = 6 days to next Friday, but +7 for "next" = 13 days
        result = DateParser.parse("next friday", base)
        assert result == "2025-02-28"
    
    def test_parse_this_weekday(self):
        """Test parsing 'this Monday', 'this Tuesday', etc."""
        # Saturday Feb 15, 2025
        base = datetime(2025, 2, 15)
        
        # This Monday should be Feb 17 (already passed, so next week)
        result = DateParser.parse("this monday", base)
        assert result == "2025-02-17"
        
        # This Saturday should be Feb 22 (next week since today is Saturday)
        result = DateParser.parse("this saturday", base)
        # Since today is Saturday (15th), "this Saturday" would be next Saturday (22nd)
        assert result == "2025-02-22"
    
    def test_parse_standalone_weekday(self):
        """Test parsing standalone day names."""
        # Saturday Feb 15, 2025
        base = datetime(2025, 2, 15)
        
        # Monday should be next Monday (17th)
        result = DateParser.parse("monday", base)
        assert result == "2025-02-17"
        
        # Friday should be next Friday (21st)
        result = DateParser.parse("friday", base)
        assert result == "2025-02-21"
        
        # Saturday should be next Saturday (22nd) since today is Saturday
        result = DateParser.parse("saturday", base)
        assert result == "2025-02-22"
    
    def test_parse_in_weeks_on_day(self):
        """Test parsing 'in X weeks on Day'."""
        # Saturday Feb 15, 2025
        base = datetime(2025, 2, 15)
        
        result = DateParser.parse("in 2 weeks on monday", base)
        # 2 weeks = 14 days, plus days until next Monday (2 days from Saturday)
        # Feb 15 + 14 + 2 = Mar 3
        assert result == "2025-03-03"
    
    def test_to_iso_datetime(self):
        """Test converting date to ISO datetime."""
        result = DateParser.to_iso_datetime("2025-04-15", end_of_day=True)
        assert result == "2025-04-15T23:59:59.000Z"
        
        result = DateParser.to_iso_datetime("2025-04-15", end_of_day=False)
        assert result == "2025-04-15T00:00:00.000Z"
    
    def test_get_relative_date_day(self):
        """Test getting relative date for 'day'."""
        base = datetime(2025, 2, 15)
        result = DateParser.get_relative_date("day", base)
        assert result == "2025-02-15T23:59:59.000Z"
    
    def test_get_relative_date_week(self):
        """Test getting relative date for 'week'."""
        base = datetime(2025, 2, 15)
        result = DateParser.get_relative_date("week", base)
        assert result == "2025-02-22T23:59:59.000Z"
    
    def test_get_relative_date_month(self):
        """Test getting relative date for 'month'."""
        base = datetime(2025, 2, 15)
        result = DateParser.get_relative_date("month", base)
        assert result == "2025-03-15T23:59:59.000Z"
    
    def test_get_relative_date_invalid(self):
        """Test getting relative date for invalid keyword."""
        result = DateParser.get_relative_date("invalid")
        assert result is None
    
    def test_parse_to_datetime_with_relative(self):
        """Test parse_to_datetime with relative keywords."""
        base = datetime(2025, 2, 15)
        result = DateParser.parse_to_datetime("day", base)
        assert result == "2025-02-15T23:59:59.000Z"
    
    def test_parse_to_datetime_with_date(self):
        """Test parse_to_datetime with natural language date."""
        base = datetime(2025, 2, 15)
        result = DateParser.parse_to_datetime("tomorrow", base)
        assert result == "2025-02-16T23:59:59.000Z"
    
    def test_case_insensitive(self):
        """Test that parsing is case insensitive."""
        base = datetime(2025, 2, 15)
        
        assert DateParser.parse("TODAY", base) == "2025-02-15"
        assert DateParser.parse("Tomorrow", base) == "2025-02-16"
        assert DateParser.parse("MONDAY", base) == "2025-02-17"
        # Next Friday from Saturday = 13 days = Feb 28
        assert DateParser.parse("Next Friday", base) == "2025-02-28"
    
    def test_whitespace_handling(self):
        """Test that extra whitespace is handled."""
        base = datetime(2025, 2, 15)
        
        assert DateParser.parse("  today  ", base) == "2025-02-15"
        assert DateParser.parse("  tomorrow  ", base) == "2025-02-16"
