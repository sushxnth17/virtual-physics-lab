from flask import Flask, render_template, request, jsonify, redirect
import importlib

app = Flask(__name__)

@app.route('/')
def home():
    # Redirect to experiments page for now
    return redirect('/experiments')

@app.route('/experiments')
def experiments():
    # Static list of available experiments (can be made dynamic later)
    experiment_list = ['lcr','diffraction','fermi','planck','photodiode','na_optical_fibre']  # Add more experiment names as they are developed
    return render_template('experiments.html', experiments=experiment_list)

@app.route('/experiments/<experiment_name>')
def experiment_page(experiment_name):
    # Render the experiment-specific template
    try:
        return render_template(f'{experiment_name}.html')
    except:
        return "Experiment not found", 404

@app.route('/api/<experiment_name>', methods=['POST'])
def api_experiment(experiment_name):
    # Handle API calls for experiments
    try:
        data = request.get_json()
        # Dynamically import the experiment module
        module = importlib.import_module(f'experiments.{experiment_name}')
        # Call the standardized compute_<experiment_name>_response function
        func_name = f'compute_{experiment_name}_response'
        func = getattr(module, func_name)
        result = func(**data)
        return jsonify(result)
    except ImportError:
        return jsonify({'error': 'Experiment module not found'}), 404
    except AttributeError:
        return jsonify({'error': f'Compute function {func_name} not found in experiment module'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
