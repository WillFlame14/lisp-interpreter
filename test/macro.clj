(defmacro infix [args]
		(list (nth args 1) (nth args 0) (nth args 2)))

(infix (2 + 3))
