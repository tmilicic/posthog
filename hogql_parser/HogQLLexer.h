
// Generated from HogQLLexer.g4 by ANTLR 4.13.0

#pragma once


#include "antlr4-runtime.h"




class  HogQLLexer : public antlr4::Lexer {
public:
  enum {
    ADD = 1, AFTER = 2, ALIAS = 3, ALL = 4, ALTER = 5, AND = 6, ANTI = 7, 
    ANY = 8, ARRAY = 9, AS = 10, ASCENDING = 11, ASOF = 12, AST = 13, ASYNC = 14, 
    ATTACH = 15, BETWEEN = 16, BOTH = 17, BY = 18, CASE = 19, CAST = 20, 
    CHECK = 21, CLEAR = 22, CLUSTER = 23, CODEC = 24, COHORT = 25, COLLATE = 26, 
    COLUMN = 27, COMMENT = 28, CONSTRAINT = 29, CREATE = 30, CROSS = 31, 
    CUBE = 32, CURRENT = 33, DATABASE = 34, DATABASES = 35, DATE = 36, DAY = 37, 
    DEDUPLICATE = 38, DEFAULT = 39, DELAY = 40, DELETE = 41, DESC = 42, 
    DESCENDING = 43, DESCRIBE = 44, DETACH = 45, DICTIONARIES = 46, DICTIONARY = 47, 
    DISK = 48, DISTINCT = 49, DISTRIBUTED = 50, DROP = 51, ELSE = 52, END = 53, 
    ENGINE = 54, EVENTS = 55, EXISTS = 56, EXPLAIN = 57, EXPRESSION = 58, 
    EXTRACT = 59, FETCHES = 60, FINAL = 61, FIRST = 62, FLUSH = 63, FOLLOWING = 64, 
    FOR = 65, FORMAT = 66, FREEZE = 67, FROM = 68, FULL = 69, FUNCTION = 70, 
    GLOBAL = 71, GRANULARITY = 72, GROUP = 73, HAVING = 74, HIERARCHICAL = 75, 
    HOUR = 76, ID = 77, IF = 78, ILIKE = 79, IN = 80, INDEX = 81, INF = 82, 
    INJECTIVE = 83, INNER = 84, INSERT = 85, INTERVAL = 86, INTO = 87, IS = 88, 
    IS_OBJECT_ID = 89, JOIN = 90, KEY = 91, KILL = 92, LAST = 93, LAYOUT = 94, 
    LEADING = 95, LEFT = 96, LIFETIME = 97, LIKE = 98, LIMIT = 99, LIVE = 100, 
    LOCAL = 101, LOGS = 102, MATERIALIZE = 103, MATERIALIZED = 104, MAX = 105, 
    MERGES = 106, MIN = 107, MINUTE = 108, MODIFY = 109, MONTH = 110, MOVE = 111, 
    MUTATION = 112, NAN_SQL = 113, NO = 114, NOT = 115, NULL_SQL = 116, 
    NULLS = 117, OFFSET = 118, ON = 119, OPTIMIZE = 120, OR = 121, ORDER = 122, 
    OUTER = 123, OUTFILE = 124, OVER = 125, PARTITION = 126, POPULATE = 127, 
    PRECEDING = 128, PREWHERE = 129, PRIMARY = 130, PROJECTION = 131, QUARTER = 132, 
    RANGE = 133, RELOAD = 134, REMOVE = 135, RENAME = 136, REPLACE = 137, 
    REPLICA = 138, REPLICATED = 139, RIGHT = 140, ROLLUP = 141, ROW = 142, 
    ROWS = 143, SAMPLE = 144, SECOND = 145, SELECT = 146, SEMI = 147, SENDS = 148, 
    SET = 149, SETTINGS = 150, SHOW = 151, SOURCE = 152, START = 153, STOP = 154, 
    SUBSTRING = 155, SYNC = 156, SYNTAX = 157, SYSTEM = 158, TABLE = 159, 
    TABLES = 160, TEMPORARY = 161, TEST = 162, THEN = 163, TIES = 164, TIMEOUT = 165, 
    TIMESTAMP = 166, TO = 167, TOP = 168, TOTALS = 169, TRAILING = 170, 
    TRIM = 171, TRUNCATE = 172, TTL = 173, TYPE = 174, UNBOUNDED = 175, 
    UNION = 176, UPDATE = 177, USE = 178, USING = 179, UUID = 180, VALUES = 181, 
    VIEW = 182, VOLUME = 183, WATCH = 184, WEEK = 185, WHEN = 186, WHERE = 187, 
    WINDOW = 188, WITH = 189, YEAR = 190, JSON_FALSE = 191, JSON_TRUE = 192, 
    ESCAPE_CHAR = 193, IDENTIFIER = 194, FLOATING_LITERAL = 195, OCTAL_LITERAL = 196, 
    DECIMAL_LITERAL = 197, HEXADECIMAL_LITERAL = 198, STRING_LITERAL = 199, 
    PLACEHOLDER = 200, ARROW = 201, ASTERISK = 202, BACKQUOTE = 203, BACKSLASH = 204, 
    COLON = 205, COMMA = 206, CONCAT = 207, DASH = 208, DOLLAR = 209, DOT = 210, 
    EQ_DOUBLE = 211, EQ_SINGLE = 212, GT_EQ = 213, GT = 214, HASH = 215, 
    IREGEX_SINGLE = 216, IREGEX_DOUBLE = 217, LBRACE = 218, LBRACKET = 219, 
    LPAREN = 220, LT_EQ = 221, LT = 222, NOT_EQ = 223, NOT_IREGEX = 224, 
    NOT_REGEX = 225, NULLISH = 226, PERCENT = 227, PLUS = 228, QUERY = 229, 
    QUOTE_DOUBLE = 230, QUOTE_SINGLE = 231, REGEX_SINGLE = 232, REGEX_DOUBLE = 233, 
    RBRACE = 234, RBRACKET = 235, RPAREN = 236, SEMICOLON = 237, SLASH = 238, 
    UNDERSCORE = 239, MULTI_LINE_COMMENT = 240, SINGLE_LINE_COMMENT = 241, 
    WHITESPACE = 242
  };

  explicit HogQLLexer(antlr4::CharStream *input);

  ~HogQLLexer() override;


  std::string getGrammarFileName() const override;

  const std::vector<std::string>& getRuleNames() const override;

  const std::vector<std::string>& getChannelNames() const override;

  const std::vector<std::string>& getModeNames() const override;

  const antlr4::dfa::Vocabulary& getVocabulary() const override;

  antlr4::atn::SerializedATNView getSerializedATN() const override;

  const antlr4::atn::ATN& getATN() const override;

  // By default the static state used to implement the lexer is lazily initialized during the first
  // call to the constructor. You can call this function if you wish to initialize the static state
  // ahead of time.
  static void initialize();

private:

  // Individual action functions triggered by action() above.

  // Individual semantic predicate functions triggered by sempred() above.

};

