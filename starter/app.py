from flask import Flask, render_template, jsonify, request
import sudoku_logic

app = Flask(__name__)

DIFFICULTY_SETTINGS = {
    'easy': 40,
    'medium': 32,
    'hard': 27,
}

CURRENT = {
    'puzzle': None,
    'solution': None,
    'difficulty': 'medium',
}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/new')
def new_game():
    difficulty = request.args.get('difficulty', 'medium').lower()
    clues = DIFFICULTY_SETTINGS.get(difficulty, DIFFICULTY_SETTINGS['medium'])
    puzzle, solution = sudoku_logic.generate_puzzle(clues)
    CURRENT['puzzle'] = puzzle
    CURRENT['solution'] = solution
    CURRENT['difficulty'] = difficulty
    return jsonify({'puzzle': puzzle, 'solution': solution, 'difficulty': difficulty, 'clues': clues})


@app.route('/check', methods=['POST'])
def check_solution():
    data = request.json or {}
    board = data.get('board')
    solution = CURRENT.get('solution')

    if solution is None:
        return jsonify({'error': 'No game in progress'}), 400

    if not isinstance(board, list) or len(board) != sudoku_logic.SIZE:
        return jsonify({'error': 'Board data is invalid'}), 400

    incorrect = []
    for row in range(sudoku_logic.SIZE):
        if len(board[row]) != sudoku_logic.SIZE:
            return jsonify({'error': 'Board row length is invalid'}), 400
        for col in range(sudoku_logic.SIZE):
            if board[row][col] != solution[row][col]:
                incorrect.append([row, col])

    solved = not incorrect and sudoku_logic.is_complete(board)
    return jsonify({
        'incorrect': incorrect,
        'solved': solved,
        'message': 'Congratulations! You solved it!' if solved else 'Some cells are still incorrect.'
    })


if __name__ == '__main__':
    app.run(debug=True)